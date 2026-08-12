const assert = require('node:assert/strict');
const test = require('node:test');

const firebaseAdmin = require('../firebaseAdmin');
const {
  getAppCheckMode,
  verifyAppCheckRequest,
} = require('../policies/appCheckPolicy');

function requestWithToken(token = '') {
  return {
    get(name) {
      return name === 'X-Firebase-AppCheck' ? token : undefined;
    },
  };
}

test('monitor mode allows a request without App Check while reporting missing', async () => {
  const result = await verifyAppCheckRequest(requestWithToken(), { mode: 'monitor' });
  assert.equal(result.ok, true);
  assert.equal(result.status, 'missing');
});

test('enforce mode rejects a request without App Check', async () => {
  const result = await verifyAppCheckRequest(requestWithToken(), { mode: 'enforce' });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'missing');
});

test('valid App Check token is accepted', async (t) => {
  const original = firebaseAdmin.getAdminAppCheck;
  firebaseAdmin.getAdminAppCheck = () => ({ verifyToken: async (token) => ({ appId: `app:${token}` }) });
  t.after(() => { firebaseAdmin.getAdminAppCheck = original; });

  const result = await verifyAppCheckRequest(requestWithToken('valid-token'), { mode: 'enforce' });
  assert.equal(result.ok, true);
  assert.equal(result.status, 'valid');
  assert.equal(result.claims.appId, 'app:valid-token');
});

test('invalid App Check token is rejected only in enforce mode', async (t) => {
  const original = firebaseAdmin.getAdminAppCheck;
  firebaseAdmin.getAdminAppCheck = () => ({ verifyToken: async () => { throw new Error('invalid'); } });
  t.after(() => { firebaseAdmin.getAdminAppCheck = original; });

  const monitor = await verifyAppCheckRequest(requestWithToken('invalid-token'), { mode: 'monitor' });
  const enforce = await verifyAppCheckRequest(requestWithToken('invalid-token'), { mode: 'enforce' });
  assert.equal(monitor.ok, true);
  assert.equal(monitor.status, 'invalid');
  assert.equal(enforce.ok, false);
  assert.equal(enforce.status, 'invalid');
});

test('Firebase emulator disables App Check enforcement', (t) => {
  const previous = process.env.FUNCTIONS_EMULATOR;
  process.env.FUNCTIONS_EMULATOR = 'true';
  t.after(() => {
    if (previous === undefined) delete process.env.FUNCTIONS_EMULATOR;
    else process.env.FUNCTIONS_EMULATOR = previous;
  });
  assert.equal(getAppCheckMode(), 'off');
});
