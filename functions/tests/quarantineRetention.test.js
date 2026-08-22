const assert = require('node:assert/strict');
const test = require('node:test');
const { Timestamp } = require('firebase-admin/firestore');
const { cleanupRejectedQuarantine, retryPromotedCleanup } = require('../handlers/quarantineRetention');
const { CLEAN_BUCKET, INFECTED_BUCKET } = require('../handlers/quarantineScanner');

const queryFirestore = documents => ({ collection: () => ({ where: () => ({ where: () => ({ limit: () => ({ get: async () => ({ docs: documents, size: documents.length, empty: documents.length === 0 }) }) }) }) }) });

test('cleanup rejected elimina origen y evidencia del scanner con generación', async () => {
  const deletes = []; const updates = [];
  const document = { id: 'doc', data: () => ({ companyId: 'acme', quarantinePath: 'companies/acme/quarantine/doc/a.pdf', scanSourceGeneration: '7', scannerQuarantineBucket: INFECTED_BUCKET, scannerQuarantinePath: 'companies/acme/quarantine/doc/a.pdf', scannerQuarantineGeneration: '12' }), ref: { update: async patch => updates.push(patch) } };
  const storage = { bucket: name => ({ file: path => ({ delete: async opts => deletes.push({ name, path, opts }) }) }) };
  const result = await cleanupRejectedQuarantine({}, { firestore: queryFirestore([document]), storage, bucket: storage.bucket('app') });
  assert.deepEqual(result, { deleted: 1, failed: 0 }); assert.equal(deletes.length, 2); assert.deepEqual(deletes.map(item => item.opts.ifGenerationMatch), [7, 12]); assert.equal(updates.length, 1);
});

test('cleanup conserva fecha de reintento si Storage falla', async () => {
  const updates = []; let deleteCalls = 0;
  const document = { id: 'doc', data: () => ({ companyId: 'acme', quarantinePath: 'companies/acme/quarantine/doc/a.pdf', scanSourceGeneration: '7' }), ref: { update: async patch => updates.push(patch) } };
  const bucket = { file: () => ({ delete: async () => { deleteCalls += 1; throw new Error('Storage temporalmente no disponible'); } }) }; const now = Timestamp.fromMillis(1000);
  const result = await cleanupRejectedQuarantine({}, { firestore: queryFirestore([document]), bucket, storage: { bucket: () => bucket }, now });
  assert.equal(result.failed, 1); assert.equal(deleteCalls, 1); assert.match(updates[0].quarantineCleanupError, /Storage temporalmente/); assert.ok(updates[0].quarantineExpiresAt.toMillis() > now.toMillis());
});

test('cleanup rejected rechaza ruta de otra empresa o documento', async () => {
  for (const quarantinePath of ['companies/other/quarantine/doc/a.pdf', 'companies/acme/quarantine/other/a.pdf']) {
    const deletes = []; const updates = [];
    const document = { id: 'doc', data: () => ({ companyId: 'acme', quarantinePath, scanSourceGeneration: '7' }), ref: { update: async patch => updates.push(patch) } };
    const bucket = { file: path => ({ delete: async () => deletes.push(path) }) };
    const result = await cleanupRejectedQuarantine({}, { firestore: queryFirestore([document]), bucket, storage: { bucket: () => bucket }, now: Timestamp.fromMillis(1000) });
    assert.equal(result.failed, 1); assert.equal(deletes.length, 0); assert.match(updates[0].quarantineCleanupError, /no corresponde/);
  }
});

test('cleanup rejected rechaza bucket de evidencia no autorizado', async () => {
  const deletes = []; const updates = [];
  const document = { id: 'doc', data: () => ({ companyId: 'acme', quarantinePath: 'companies/acme/quarantine/doc/a.pdf', scanSourceGeneration: '7', scannerQuarantineBucket: 'otro-bucket', scannerQuarantinePath: 'companies/acme/quarantine/doc/a.pdf', scannerQuarantineGeneration: '12' }), ref: { update: async patch => updates.push(patch) } };
  const storage = { bucket: name => ({ file: path => ({ delete: async () => deletes.push({ name, path }) }) }) };
  const result = await cleanupRejectedQuarantine({}, { firestore: queryFirestore([document]), storage, bucket: storage.bucket('app'), now: Timestamp.fromMillis(1000) });
  assert.equal(result.failed, 1); assert.equal(deletes.length, 0); assert.match(updates[0].quarantineCleanupError, /Bucket de cuarentena inválido/);
});

test('cleanup de promoción reintenta borrados con precondiciones', async () => {
  const deletes = []; const updates = [];
  const document = { id: 'doc', data: () => ({ companyId: 'acme', quarantinePath: 'companies/acme/quarantine/doc/a.pdf', scanSourceGeneration: '7', scannerCleanBucket: CLEAN_BUCKET, scannerCleanPath: 'companies/acme/quarantine/doc/a.pdf', scannerCleanGeneration: '11' }), ref: { update: async patch => updates.push(patch) } };
  const storage = { bucket: name => ({ file: path => ({ delete: async opts => deletes.push({ name, path, opts }) }) }) };
  const result = await retryPromotedCleanup({}, { firestore: queryFirestore([document]), storage, bucket: storage.bucket('app') });
  assert.deepEqual(result, { cleaned: 1, failed: 0, hasMore: false }); assert.deepEqual(deletes.map(item => item.opts.ifGenerationMatch), [7, 11]); assert.equal(updates.length, 1);
});
