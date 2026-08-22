const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const firebaseAdmin = require('../firebaseAdmin');
const { isDemoFunctionsEmulator } = require('../policies/httpPolicy');
const CLIENT_ACTIONS = Object.freeze({ client_activity: ['owner', 'director', 'admin', 'editor', 'viewer'] });
const ALLOWED_FIELDS = new Set(['companyId', 'action', 'entity_type', 'entity_id', 'details', 'correlationId']);
const EMULATOR_APP_CHECK_TOKEN = 'firebase-emulator-app-check';
const RELEASE = Object.freeze({ appVersion: process.env.APP_VERSION || 'unknown', buildId: process.env.BUILD_ID || process.env.K_REVISION || 'unknown', gitSha: process.env.GIT_SHA || 'unknown' });
const fail = (status, message) => Object.assign(new Error(message), { status });
function boundedString(value, max, required = false) { if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw fail(400, 'Payload de actividad inválido.'); return value.trim(); }
function expiry() { return Timestamp.fromMillis(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000); }
async function verifyAppCheckToken(token) {
  if (isDemoFunctionsEmulator() && token === EMULATOR_APP_CHECK_TOKEN) return;
  try { await firebaseAdmin.getAdminAppCheck().verifyToken(token); } catch { throw fail(401, 'App Check inválido.'); }
}
async function appendAuditLog(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });
  try {
    const appCheckToken = String(req.get('x-firebase-appcheck') || ''); if (!appCheckToken) throw fail(401, 'App Check requerido.');
    await verifyAppCheckToken(appCheckToken);
    const token = String(req.get('authorization') || '').replace(/^Bearer\s+/i, ''); if (!token) throw fail(401, 'Autenticación requerida.');
    let user; try { user = await firebaseAdmin.getAdminAuth().verifyIdToken(token); } catch { throw fail(401, 'Token inválido.'); } const body = req.body || {};
    if (Object.keys(body).some(key => !ALLOWED_FIELDS.has(key)) || !CLIENT_ACTIONS[body.action]) throw fail(400, 'Actividad cliente no permitida.');
    const companyId = boundedString(body.companyId, 180, true); const membership = await firebaseAdmin.getAdminFirestore().collection('companyMembers').doc(`${companyId}_${user.uid}`).get();
    const role = membership.exists ? membership.data().role : null;
    if (membership.data()?.status !== 'active' || !CLIENT_ACTIONS[body.action].includes(role)) throw fail(403, 'Rol no permitido para esta actividad.');
    const correlationId = boundedString(body.correlationId || '', 128, true);
    const id = `client_${companyId}_${user.uid}_${body.action}_${correlationId}`.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 500);
    await firebaseAdmin.getAdminFirestore().collection('auditLogs').doc(id).create({ companyId, action: body.action, entity_type: boundedString(body.entity_type || '', 100), entity_id: boundedString(body.entity_id || '', 180), details: boundedString(body.details || '', 1000), correlationId, actorUid: user.uid, role, authoritative: false, source: 'client', release: RELEASE, createdAt: FieldValue.serverTimestamp(), expiresAt: expiry(), immutable: true });
    return res.status(201).json({ success: true, id });
  } catch (error) { if (error.code === 6 || error.code === 'already-exists') return res.status(200).json({ success: true, duplicate: true }); return res.status(Number(error.status) || 500).json({ error: Number(error.status) ? error.message : 'Error interno de auditoría.' }); }
}
module.exports = { ALLOWED_FIELDS, CLIENT_ACTIONS, EMULATOR_APP_CHECK_TOKEN, appendAuditLog, boundedString, verifyAppCheckToken };
