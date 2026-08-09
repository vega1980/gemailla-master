import { beforeEach, describe, it } from 'node:test';
import { assertAllowed, assertDenied, clearFirestore, firestoreDomainPatch, firestoreDomainSet, firestoreSet, seedCompany } from './rules-test-utils.mjs';
const companyId = 'doc-sec'; const editor = { uid: 'doc-editor', claims: {} };
const base = { companyId, title: 'factura.pdf', contentType: 'application/pdf', fileSize: 100, fileType: 'pdf', status: 'uploading' };
describe('frontera Firestore de cuarentena', () => {
  beforeEach(async () => { await clearFirestore(); await seedCompany({ companyId, ownerUid: 'owner', memberships: [{ userUid: editor.uid, role: 'editor', status: 'active' }] }); });
  it('solo permite crear uploading sin campos backend', async () => {
    await assertAllowed(firestoreDomainSet('documents/ok', base, editor), 'create uploading');
    for (const bypass of [{ status: 'uploaded' }, { storagePath: 'companies/x/documents/x/a.pdf' }, { scanStatus: 'clean' }, { scanEventId: 'fake' }, { scanHash: 'fake' }]) await assertDenied(firestoreDomainSet(`documents/bypass-${Object.keys(bypass)[0]}`, { ...base, ...bypass }, editor), 'create bypass');
  });
  it('permite transiciones mínimas y bloquea falsificación técnica', async () => {
    await assertAllowed(firestoreSet('documents/doc', base), 'seed backend');
    await assertAllowed(firestoreDomainPatch('documents/doc', { status: 'quarantined' }, editor), 'uploading to quarantined');
    await assertAllowed(firestoreDomainPatch('documents/doc', { status: 'error', errorMessage: 'falló' }, editor), 'quarantined to error');
    for (const patch of [{ status: 'uploaded' }, { storagePath: 'companies/doc-sec/documents/doc/a.pdf' }, { scanStatus: 'clean' }, { scanEventId: 'fake' }, { scanGeneration: '1' }, { scannedAt: 'fake' }, { scanHash: 'fake' }, { quarantineCleanupPending: false }]) { await assertAllowed(firestoreSet('documents/attack', base), 'reset'); await assertDenied(firestoreDomainPatch('documents/attack', patch, editor), `bloquea ${Object.keys(patch)[0]}`); }
  });
});
