const admin = require('firebase-admin');
const { requireCompanyId, validateCompanyMembershipAccess } = require('./aiHandler');


function getBearerToken(req) {
  const authHeader = req.get('authorization') || '';
  const [scheme, token] = authHeader.split(' ');
  return scheme?.toLowerCase() === 'bearer' ? token : null;
}

async function verifyFirebaseUser(req) {
  const token = getBearerToken(req);
  if (!token) {
    const error = new Error('Autenticación requerida para usar IA.');
    error.status = 401;
    throw error;
  }

  try {
    return await admin.auth().verifyIdToken(token);
  } catch (_error) {
    const error = new Error('Token de Firebase inválido o expirado.');
    error.status = 401;
    throw error;
  }
}

async function syncCompanyClaimsHandler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  try {
    const user = await verifyFirebaseUser(req);
    const companyId = requireCompanyId(req.body || {});
    const access = await validateCompanyMembershipAccess({ user, companyId });

    return res.status(200).json({
      success: true,
      companyId,
      companyRole: access.role,
      membershipStatus: 'active',
      claimsUpdated: false,
      authorizationSource: 'companyMembers',
    });
  } catch (error) {
    return res.status(Number(error?.status) || 500).json({
      error: error?.message || 'No se pudieron validar los permisos de empresa.',
    });
  }
}

module.exports = { syncCompanyClaimsHandler };
