const firebaseAdmin = require('../firebaseAdmin');

const APP_CHECK_HEADER = 'X-Firebase-AppCheck';
const VALID_MODES = new Set(['off', 'monitor', 'enforce']);

function getAppCheckMode() {
  if (process.env.FUNCTIONS_EMULATOR === 'true') return 'off';
  const configuredMode = String(process.env.APP_CHECK_ENFORCEMENT || 'monitor').trim().toLowerCase();
  return VALID_MODES.has(configuredMode) ? configuredMode : 'monitor';
}

function getAppCheckToken(req) {
  const value = req.get(APP_CHECK_HEADER);
  return typeof value === 'string' ? value.trim() : '';
}

async function verifyAppCheckRequest(req, options = {}) {
  const mode = options.mode || getAppCheckMode();
  if (mode === 'off') return { ok: true, mode, status: 'disabled' };

  const token = getAppCheckToken(req);
  if (!token) {
    return { ok: mode !== 'enforce', mode, status: 'missing' };
  }

  try {
    const claims = await firebaseAdmin.getAdminAppCheck().verifyToken(token);
    return { ok: true, mode, status: 'valid', claims };
  } catch (_error) {
    return { ok: mode !== 'enforce', mode, status: 'invalid' };
  }
}

async function enforceAppCheckPolicy(req, res, options = {}) {
  const result = await verifyAppCheckRequest(req, options);

  if (result.status !== 'valid' && result.status !== 'disabled') {
    console.warn('app_check_request', {
      mode: result.mode,
      status: result.status,
      path: req.originalUrl || req.url || '',
    });
  }

  if (!result.ok) {
    res.status(401).json({ error: 'App Check inválido o ausente.' });
    return true;
  }

  return false;
}

module.exports = {
  APP_CHECK_HEADER,
  enforceAppCheckPolicy,
  getAppCheckMode,
  getAppCheckToken,
  verifyAppCheckRequest,
};
