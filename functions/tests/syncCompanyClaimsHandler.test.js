const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
const firebaseAdmin = require('../firebaseAdmin');

function loadHandler() {
  const modulePath = require.resolve('../handlers/syncCompanyClaimsHandler');
  delete require.cache[modulePath];

  const originalLoad = Module._load;

  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === './aiHandler') {
      return {
        requireCompanyId(body = {}) {
          const companyId = String(body.companyId || '').trim();
          if (!companyId) {
            const error = new Error('companyId es obligatorio.');
            error.status = 400;
            throw error;
          }
          return companyId;
        },
        async validateCompanyMembershipAccess() {
          return { role: 'owner' };
        },
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return require(modulePath).syncCompanyClaimsHandler;
  } finally {
    Module._load = originalLoad;
  }
}

function req({ appCheckToken = '', authToken = 'valid-auth' } = {}) {
  return {
    method: 'POST',
    body: { companyId: 'company-a' },
    get(name) {
      const header = String(name).toLowerCase();
      if (header === 'authorization') return `Bearer ${authToken}`;
      if (header === 'x-firebase-appcheck') return appCheckToken;
      return '';
    },
  };
}

function res() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

function mockAdmin(t) {
  const originalGetAdminAuth = firebaseAdmin.getAdminAuth;
  const originalGetAdminAppCheck = firebaseAdmin.getAdminAppCheck;

  firebaseAdmin.getAdminAuth = () => ({
    async verifyIdToken(token) {
      if (token !== 'valid-auth') throw new Error('invalid auth');
      return { uid: 'owner-uid' };
    },
  });

  firebaseAdmin.getAdminAppCheck = () => ({
    async verifyToken(token) {
      if (token !== 'valid-app-check') throw new Error('invalid app check');
      return { appId: 'test-app' };
    },
  });

  t.after(() => {
    firebaseAdmin.getAdminAuth = originalGetAdminAuth;
    firebaseAdmin.getAdminAppCheck = originalGetAdminAppCheck;
  });
}

test('syncCompanyClaims rejects missing App Check', async (t) => {
  mockAdmin(t);
  const handler = loadHandler();
  const response = res();

  await handler(req({ appCheckToken: '' }), response);

  assert.equal(response.statusCode, 401);
});

test('syncCompanyClaims rejects invalid App Check', async (t) => {
  mockAdmin(t);
  const handler = loadHandler();
  const response = res();

  await handler(req({ appCheckToken: 'invalid-app-check' }), response);

  assert.equal(response.statusCode, 401);
});

test('syncCompanyClaims accepts valid App Check and valid Auth', async (t) => {
  mockAdmin(t);
  const handler = loadHandler();
  const response = res();

  await handler(req({ appCheckToken: 'valid-app-check' }), response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.companyId, 'company-a');
  assert.equal(response.payload.companyRole, 'owner');
});
