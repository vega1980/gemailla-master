const assert = require('node:assert/strict');
const test = require('node:test');
const firebaseAdmin = require('../firebaseAdmin');
const { appendAuditLog } = require('../handlers/auditLogHandler');

function response() { return { statusCode: 0, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }
function request(body, headers = {}) { return { method: 'POST', body, get: name => headers[name.toLowerCase()] || '' }; }
function mockAdmin(t) {
  const writes = [];
  const originals = { app: firebaseAdmin.getAdminAppCheck, auth: firebaseAdmin.getAdminAuth, db: firebaseAdmin.getAdminFirestore };
  firebaseAdmin.getAdminAppCheck = () => ({ verifyToken: async token => { if (token !== 'app-ok') throw new Error('bad app'); } });
  firebaseAdmin.getAdminAuth = () => ({ verifyIdToken: async token => { if (token !== 'auth-ok') throw new Error('bad auth'); return { uid: 'user' }; } });
  firebaseAdmin.getAdminFirestore = () => ({ collection: name => name === 'companyMembers' ? { doc: () => ({ get: async () => ({ exists: true, data: () => ({ status: 'active', role: 'editor' }) }) }) } : { doc: id => ({ create: async value => { writes.push({ id, ...value }); } }) } });
  t.after(() => { firebaseAdmin.getAdminAppCheck = originals.app; firebaseAdmin.getAdminAuth = originals.auth; firebaseAdmin.getAdminFirestore = originals.db; });
  return writes;
}
test('appendAuditLog exige App Check y autenticación', async t => {
  mockAdmin(t); const res = response(); await appendAuditLog(request({}), res); assert.equal(res.statusCode, 401);
  const res2 = response(); await appendAuditLog(request({}, { 'x-firebase-appcheck': 'app-ok' }), res2); assert.equal(res2.statusCode, 401);
});
test('rechaza acciones críticas/inventadas y limita detalles', async t => {
  mockAdmin(t); const headers = { 'x-firebase-appcheck': 'app-ok', authorization: 'Bearer auth-ok' };
  const critical = response(); await appendAuditLog(request({ companyId: 'acme', action: 'permission_escalated' }, headers), critical); assert.equal(critical.statusCode, 400);
  const oversized = response(); await appendAuditLog(request({ companyId: 'acme', action: 'client_activity', details: 'x'.repeat(1001) }, headers), oversized); assert.equal(oversized.statusCode, 400);
});
test('actividad cliente permitida queda marcada no autoritativa y con id determinista', async t => {
  const writes = mockAdmin(t); const res = response();
  await appendAuditLog(request({ companyId: 'acme', action: 'client_activity', entity_type: 'Document', entity_id: 'd1', details: 'ok', correlationId: 'c1' }, { 'x-firebase-appcheck': 'app-ok', authorization: 'Bearer auth-ok' }), res);
  assert.equal(res.statusCode, 201); assert.equal(writes[0].actorUid, 'user'); assert.equal(writes[0].immutable, true); assert.equal(writes[0].authoritative, false); assert.match(writes[0].id, /client_acme_user_client_activity_c1/);
});
test('error interno de Firestore responde 500, no 401', async t => {
  mockAdmin(t); const original = firebaseAdmin.getAdminFirestore;
  firebaseAdmin.getAdminFirestore = () => ({ collection: () => { throw new Error('firestore down'); } });
  t.after(() => { firebaseAdmin.getAdminFirestore = original; });
  const res = response(); await appendAuditLog(request({ companyId: 'acme', action: 'client_activity', correlationId: 'c1' }, { 'x-firebase-appcheck': 'app-ok', authorization: 'Bearer auth-ok' }), res);
  assert.equal(res.statusCode, 500);
});
