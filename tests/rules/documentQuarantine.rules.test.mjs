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
  it('permite únicamente las transiciones de análisis y archivado usadas por la aplicación', async () => {
    await assertAllowed(firestoreSet('documents/analysis', { ...base, status: 'uploaded', storagePath: `companies/${companyId}/documents/analysis/file.pdf` }), 'seed promoted document');
    await assertAllowed(firestoreDomainPatch('documents/analysis', { status: 'processing', aiDisabled: false, errorMessage: null, correlationId: 'analysis-1', release: { version: 'test' } }, editor), 'uploaded to processing');
    await assertAllowed(firestoreDomainPatch('documents/analysis', { status: 'analyzed', aiDisabled: false, errorMessage: null, correlationId: 'analysis-1', total: 100, tags: ['factura'] }, editor), 'processing to analyzed');
    await assertAllowed(firestoreDomainPatch('documents/analysis', { status: 'archived', archivedAt: '2026-01-02T00:00:00.000Z' }, editor), 'analyzed to archived');
  });
  it('mantiene bloqueados los campos del escáner durante análisis y archivado', async () => {
    await assertAllowed(firestoreSet('documents/locked', { ...base, status: 'uploaded', storagePath: `companies/${companyId}/documents/locked/file.pdf` }), 'seed promoted document');
    await assertDenied(firestoreDomainPatch('documents/locked', { status: 'processing', storagePath: 'companies/doc-sec/documents/other/file.pdf' }, editor), 'analysis cannot replace storage path');
    await assertDenied(firestoreDomainPatch('documents/locked', { status: 'archived', scanStatus: 'clean' }, editor), 'archive cannot forge scan status');
  });
});
