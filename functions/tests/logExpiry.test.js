const assert = require('node:assert/strict'); const test = require('node:test');
const { RETENTION_DAYS, assignManagedExpiry } = require('../handlers/logExpiry');
function event(data) { const updates = []; return { updates, value: { data: () => data, ref: { update: async patch => updates.push(patch) } } }; }
test('asigna expiresAt backend a todas las colecciones TTL', async () => { for (const name of Object.keys(RETENTION_DAYS)) { const e = event({}); await assignManagedExpiry({ data: e.value }, name); assert.ok(e.updates[0].expiresAt); } });
test('legalHold deja expiresAt null y un expiresAt existente no se sustituye', async () => { const hold = event({ legalHold: true }); await assignManagedExpiry({ data: hold.value }, 'auditLogs'); assert.equal(hold.updates[0].expiresAt, null); const existing = event({ expiresAt: 'existing' }); await assignManagedExpiry({ data: existing.value }, 'auditLogs'); assert.equal(existing.updates.length, 0); });
