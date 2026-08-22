const assert = require('node:assert/strict');
const test = require('node:test');
const { DEFAULT_ALLOWED_ORIGINS, getAllowedOrigins } = require('../policies/httpPolicy');

function restore(name, value) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }

test('CORS agrega loopback únicamente en Functions Emulator con proyecto demo', t => {
  const previous = { allowed: process.env.ALLOWED_ORIGINS, emulator: process.env.FUNCTIONS_EMULATOR, project: process.env.GCLOUD_PROJECT };
  t.after(() => { restore('ALLOWED_ORIGINS', previous.allowed); restore('FUNCTIONS_EMULATOR', previous.emulator); restore('GCLOUD_PROJECT', previous.project); });
  delete process.env.ALLOWED_ORIGINS; process.env.FUNCTIONS_EMULATOR = 'true'; process.env.GCLOUD_PROJECT = 'demo-gemailla-e2e';
  assert.deepEqual(getAllowedOrigins(), [...DEFAULT_ALLOWED_ORIGINS, 'http://127.0.0.1:5000', 'http://localhost:5000']);
});

test('CORS de producción conserva exclusivamente la lista estricta', t => {
  const previous = { allowed: process.env.ALLOWED_ORIGINS, emulator: process.env.FUNCTIONS_EMULATOR, project: process.env.GCLOUD_PROJECT };
  t.after(() => { restore('ALLOWED_ORIGINS', previous.allowed); restore('FUNCTIONS_EMULATOR', previous.emulator); restore('GCLOUD_PROJECT', previous.project); });
  delete process.env.ALLOWED_ORIGINS; delete process.env.FUNCTIONS_EMULATOR; process.env.GCLOUD_PROJECT = 'gemailla-enterprise';
  assert.deepEqual(getAllowedOrigins(), [...DEFAULT_ALLOWED_ORIGINS]);
});
