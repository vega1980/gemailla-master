const firebaseAdmin = require('../firebaseAdmin');
const { fail, isDemoFunctionsEmulator } = require('./httpPolicy');

const EMULATOR_APP_CHECK_TOKEN = 'firebase-emulator-app-check';

async function verifyAppCheckRequest(req) {
  const token = String(req.get('x-firebase-appcheck') || '').trim();

  if (!token) {
    fail(401, 'App Check requerido.');
  }

  if (isDemoFunctionsEmulator() && token === EMULATOR_APP_CHECK_TOKEN) {
    return { emulator: true };
  }

  try {
    return await firebaseAdmin.getAdminAppCheck().verifyToken(token);
  } catch {
    fail(401, 'App Check inválido.');
  }
}

module.exports = {
  EMULATOR_APP_CHECK_TOKEN,
  verifyAppCheckRequest,
};
