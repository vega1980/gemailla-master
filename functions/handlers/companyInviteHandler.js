const admin = require('firebase-admin');
const crypto = require('node:crypto');
const { fail } = require('../policies/httpPolicy');

const ACTIVE_STATUSES = new Set(['active', 'activo']);
const MANAGER_ROLES = new Set(['owner', 'director', 'admin']);
const ALLOWED_INVITE_ROLES = new Set(['director', 'admin', 'editor', 'viewer', 'invitado']);
const DEFAULT_INVITATION_TTL_HOURS = 72;

function getBearerToken(req) {
  const authHeader = req.get('authorization') || '';
  const [scheme, token] = authHeader.split(' ');
  return scheme?.toLowerCase() === 'bearer' ? token : null;
}

async function verifyFirebaseUser(req) {
  const token = getBearerToken(req);
  if (!token) fail(401, 'Autenticación requerida.');
  try {
    return await admin.auth().verifyIdToken(token);
  } catch (_error) {
    fail(401, 'Token de Firebase inválido o expirado.');
  }
}

function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase();
}

function parseInviteRole(role) {
  const normalized = String(role || 'viewer').trim().toLowerCase();
  if (!ALLOWED_INVITE_ROLES.has(normalized)) fail(400, 'Rol de invitación inválido.');
  return normalized;
}

function createInviteToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashInviteToken(token) {
  return crypto.createHash('sha256').update(String(token || ''), 'utf8').digest('hex');
}

function compareTokenHash(token, expectedHash = '') {
  const actual = Buffer.from(hashInviteToken(token), 'hex');
  const expected = Buffer.from(String(expectedHash || ''), 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function getInvitationExpiry(now = new Date()) {
  const ttlHours = Math.max(1, Number(process.env.COMPANY_INVITATION_TTL_HOURS || DEFAULT_INVITATION_TTL_HOURS));
  return new Date(now.getTime() + ttlHours * 60 * 60 * 1000).toISOString();
}

function buildInvitationContinueUrl({ invitationId, token }) {
  const baseUrl = String(process.env.COMPANY_INVITATION_ACCEPT_URL || 'https://gemailla.com/accept-invitation').trim();
  const url = new URL(baseUrl);
  url.searchParams.set('invitationId', invitationId);
  url.searchParams.set('token', token);
  return url.toString();
}

async function enqueueInvitationEmail({ db, email, companyId, invitationId, continueUrl, expiresAt }) {
  const mailCollection = String(process.env.COMPANY_INVITATION_MAIL_COLLECTION || 'mail').trim();
  await db.collection(mailCollection).add({
    to: email,
    message: {
      subject: 'Invitación para unirte a GEMAILLA',
      text: `Has sido invitado a la empresa ${companyId}. Acepta la invitación antes de ${expiresAt}: ${continueUrl}`,
      html: `<p>Has sido invitado a la empresa <strong>${companyId}</strong>.</p><p><a href="${continueUrl}">Aceptar invitación</a></p><p>Expira: ${expiresAt}</p>`,
    },
    metadata: {
      type: 'company_invitation',
      companyId,
      invitationId,
    },
    createdAt: new Date().toISOString(),
  });
}

async function assertCanManageCompany({ db, companyId, user }) {
  const companySnap = await db.collection('companies').doc(companyId).get();
  if (!companySnap.exists) fail(403, 'Empresa no válida o sin acceso.');
  const company = companySnap.data() || {};
  if (!ACTIVE_STATUSES.has(String(company.status || 'active').toLowerCase())) {
    fail(403, 'La empresa no está activa.');
  }

  if ((company.ownerUid || company.createdBy) === user.uid) {
    return { role: 'owner', company };
  }

  const membershipId = `${companyId}_${user.uid}`;
  const membershipSnap = await db.collection('companyMembers').doc(membershipId).get();
  if (!membershipSnap.exists) fail(403, 'No tienes permisos para invitar miembros.');
  const membership = membershipSnap.data() || {};
  const role = String(membership.role || '').toLowerCase();
  if (membership.companyId !== companyId || membership.userUid !== user.uid || !ACTIVE_STATUSES.has(String(membership.status || '').toLowerCase()) || !MANAGER_ROLES.has(role)) {
    fail(403, 'No tienes permisos para invitar miembros.');
  }

  return { role, company };
}

async function inviteCompanyMemberHandler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });

  try {
    const user = await verifyFirebaseUser(req);
    const db = admin.firestore();
    const companyId = String(req.body?.companyId || '').trim();
    const email = normalizeEmail(req.body?.userEmail || req.body?.email);
    const role = parseInviteRole(req.body?.role);
    if (!companyId) fail(400, 'companyId es obligatorio.');
    if (!email || !email.includes('@')) fail(400, 'Email de invitado inválido.');

    await assertCanManageCompany({ db, companyId, user });

    const nowDate = new Date();
    const now = nowDate.toISOString();
    const token = createInviteToken();
    const invitationRef = db.collection('companyInvitations').doc();
    const invitationId = invitationRef.id;
    const invitation = {
      companyId,
      userEmail: email,
      role,
      status: 'pending',
      tokenHash: hashInviteToken(token),
      expiresAt: getInvitationExpiry(nowDate),
      invitedByUid: user.uid,
      createdAt: now,
      updatedAt: now,
    };
    await invitationRef.set(invitation);

    const continueUrl = buildInvitationContinueUrl({ invitationId, token });
    let emailLink = continueUrl;
    try {
      emailLink = await admin.auth().generateSignInWithEmailLink(email, {
        url: continueUrl,
        handleCodeInApp: true,
      });
    } catch (_error) {
      // Keep returning a backend-generated invitation link even when Auth email
      // link generation is not configured in local/test environments.
    }
    await enqueueInvitationEmail({ db, email, companyId, invitationId, continueUrl: emailLink, expiresAt: invitation.expiresAt });

    return res.status(202).json({
      success: true,
      status: 'invitation_pending',
      invitationId,
      expiresAt: invitation.expiresAt,
    });
  } catch (error) {
    return res.status(Number(error?.status) || 500).json({
      error: error?.message || 'No se pudo invitar al miembro.',
    });
  }
}

async function acceptCompanyInvitationHandler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });

  try {
    const user = await verifyFirebaseUser(req);
    const db = admin.firestore();
    const invitationId = String(req.body?.invitationId || '').trim();
    const token = String(req.body?.token || '').trim();
    if (!invitationId || !token) fail(400, 'invitationId y token son obligatorios.');
    if (user.email_verified !== true && user.emailVerified !== true) fail(403, 'Debes verificar tu correo antes de aceptar la invitación.');

    const invitationRef = db.collection('companyInvitations').doc(invitationId);
    const result = await db.runTransaction(async (transaction) => {
      const invitationSnap = await transaction.get(invitationRef);
      if (!invitationSnap.exists) fail(404, 'Invitación no encontrada.');
      const invitation = invitationSnap.data() || {};
      if (invitation.status !== 'pending') fail(409, 'La invitación ya no está pendiente.');
      if (!compareTokenHash(token, invitation.tokenHash)) fail(403, 'Token de invitación inválido.');
      if (new Date(invitation.expiresAt || 0).getTime() <= Date.now()) fail(410, 'La invitación expiró.');

      const userEmail = normalizeEmail(user.email);
      if (!userEmail || userEmail !== normalizeEmail(invitation.userEmail)) {
        fail(403, 'La invitación pertenece a otro correo.');
      }

      const membershipId = `${invitation.companyId}_${user.uid}`;
      const membershipRef = db.collection('companyMembers').doc(membershipId);
      const membershipSnap = await transaction.get(membershipRef);
      if (!membershipSnap.exists) {
        const now = new Date().toISOString();
        transaction.set(membershipRef, {
          companyId: invitation.companyId,
          userUid: user.uid,
          userEmail,
          userName: user.name || userEmail,
          role: invitation.role,
          status: 'active',
          invitedByUid: invitation.invitedByUid,
          invitationId,
          acceptedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }
      transaction.update(invitationRef, {
        status: 'accepted',
        acceptedByUid: user.uid,
        acceptedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return { membershipId, companyId: invitation.companyId, role: invitation.role };
    });

    return res.status(200).json({ success: true, status: 'accepted', ...result });
  } catch (error) {
    return res.status(Number(error?.status) || 500).json({
      error: error?.message || 'No se pudo aceptar la invitación.',
    });
  }
}

module.exports = {
  inviteCompanyMemberHandler,
  acceptCompanyInvitationHandler,
  assertCanManageCompany,
  compareTokenHash,
  hashInviteToken,
};
