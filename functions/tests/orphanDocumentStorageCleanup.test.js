const assert = require('node:assert/strict');
const test = require('node:test');
const firebaseAdmin = require('../firebaseAdmin');

const {
  cleanupOrphanDocumentStorageHandler,
  documentHasValidMetadata,
  parseDocumentStoragePath,
} = require('../handlers/orphanDocumentStorageCleanup');

const OLD_DATE = '2026-01-01T00:00:00.000Z';

function file(name, { timeCreated = OLD_DATE } = {}) {
  const moves = [];
  return {
    name,
    moves,
    async getMetadata() { return [{ timeCreated }]; },
    async move(destination) { moves.push(destination); },
  };
}

function setCleanupEnv(t, values = {}) {
  const names = [
    'ORPHAN_DOCUMENT_CLEANUP_DRY_RUN',
    'ORPHAN_DOCUMENT_CLEANUP_MAX_FILES',
    'ORPHAN_DOCUMENT_CLEANUP_MIN_FILE_AGE_MINUTES',
    'ORPHAN_DOCUMENT_QUARANTINE_PREFIX',
    'DOCUMENT_SUCCESSFUL_STATUSES',
  ];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  for (const name of names) delete process.env[name];
  for (const [name, value] of Object.entries(values)) process.env[name] = String(value);
  t.after(() => {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  });
}

function mockAdmin(t, { documents = {}, files = [], firestoreError = null } = {}) {
  const documentStore = new Map(Object.entries(documents));
  const db = {
    collection(name) {
      assert.equal(name, 'documents');
      return {
        doc(id) {
          return {
            async get() {
              if (firestoreError) throw firestoreError;
              const data = documentStore.get(id);
              return { exists: data !== undefined, data: () => data };
            },
          };
        },
      };
    },
  };
  const bucket = {
    queries: [],
    async getFiles(query) {
      this.queries.push(query);
      return [files, null];
    },
  };

  const originalGetAdminFirestore = firebaseAdmin.getAdminFirestore;
  const originalGetAdminStorage = firebaseAdmin.getAdminStorage;
  firebaseAdmin.getAdminFirestore = () => db;
  firebaseAdmin.getAdminStorage = () => ({ bucket: () => bucket });
  t.after(() => {
    firebaseAdmin.getAdminFirestore = originalGetAdminFirestore;
    firebaseAdmin.getAdminStorage = originalGetAdminStorage;
  });
  return { db, bucket };
}

test('parseDocumentStoragePath accepts only canonical document object paths', () => {
  assert.deepEqual(
    parseDocumentStoragePath('companies/company-a/documents/doc-a/file.pdf'),
    { companyId: 'company-a', documentId: 'doc-a' },
  );
  assert.equal(parseDocumentStoragePath('companies/company-a/documents/doc-a/'), null);
  assert.equal(parseDocumentStoragePath('companies/company-a/private/doc-a/file.pdf'), null);
  assert.equal(parseDocumentStoragePath('companies/company-a/documents/doc-a/nested/file.pdf'), null);
});

test('document metadata validity depends only on existence and matching companyId', async () => {
  const db = {
    collection: () => ({
      doc: (id) => ({
        get: async () => ({
          exists: id !== 'missing',
          data: () => (id === 'wrong-company' ? { companyId: 'company-b' } : { companyId: 'company-a', status: 'archived' }),
        }),
      }),
    }),
  };
  assert.equal(await documentHasValidMetadata({ db, companyId: 'company-a', documentId: 'archived' }), true);
  assert.equal(await documentHasValidMetadata({ db, companyId: 'company-a', documentId: 'missing' }), false);
  assert.equal(await documentHasValidMetadata({ db, companyId: 'company-a', documentId: 'wrong-company' }), false);
});

test('archived and other statuses with valid metadata are preserved', async (t) => {
  setCleanupEnv(t, { ORPHAN_DOCUMENT_CLEANUP_DRY_RUN: 'false' });
  const archived = file('companies/company-a/documents/archived/file.pdf');
  const errorStatus = file('companies/company-a/documents/error/file.xml');
  mockAdmin(t, {
    documents: {
      archived: { companyId: 'company-a', status: 'archived' },
      error: { companyId: 'company-a', status: 'error' },
    },
    files: [archived, errorStatus],
  });

  const result = await cleanupOrphanDocumentStorageHandler();
  assert.deepEqual(result, { scanned: 2, quarantined: 0, skipped: 2, dryRun: false });
  assert.equal(archived.moves.length, 0);
  assert.equal(errorStatus.moves.length, 0);
});

test('missing metadata and mismatched companyId are classified as orphaned', async (t) => {
  setCleanupEnv(t);
  const missing = file('companies/company-a/documents/missing/file.pdf');
  const mismatched = file('companies/company-a/documents/wrong/file.pdf');
  mockAdmin(t, {
    documents: { wrong: { companyId: 'company-b', status: 'active' } },
    files: [missing, mismatched],
  });

  const result = await cleanupOrphanDocumentStorageHandler();
  assert.equal(result.quarantined, 2);
  assert.equal(missing.moves.length, 0);
  assert.equal(mismatched.moves.length, 0);
});

test('a Firestore error aborts safely without quarantining or moving the file', async (t) => {
  setCleanupEnv(t, { ORPHAN_DOCUMENT_CLEANUP_DRY_RUN: 'false' });
  const candidate = file('companies/company-a/documents/doc-a/file.pdf');
  const error = Object.assign(new Error('temporary backend detail'), { code: 'unavailable' });
  mockAdmin(t, { files: [candidate], firestoreError: error });
  const logs = [];
  const originalError = console.error;
  console.error = (value) => logs.push(String(value));
  t.after(() => { console.error = originalError; });

  await assert.rejects(cleanupOrphanDocumentStorageHandler(), error);
  assert.equal(candidate.moves.length, 0);
  assert.equal(logs.length, 1);
  assert.match(logs[0], /orphan_document_storage_metadata_lookup_failed/);
  assert.match(logs[0], /unavailable/);
  assert.doesNotMatch(logs[0], /company-a|doc-a|temporary backend detail/);
});

test('dry-run counts an orphan without moving it', async (t) => {
  setCleanupEnv(t, { ORPHAN_DOCUMENT_CLEANUP_DRY_RUN: 'true' });
  const candidate = file('companies/company-a/documents/missing/file.pdf');
  mockAdmin(t, { files: [candidate] });
  const result = await cleanupOrphanDocumentStorageHandler();
  assert.equal(result.quarantined, 1);
  assert.equal(result.dryRun, true);
  assert.equal(candidate.moves.length, 0);
});

test('grace period skips recent files before querying Firestore', async (t) => {
  setCleanupEnv(t, { ORPHAN_DOCUMENT_CLEANUP_DRY_RUN: 'false' });
  const recent = file('companies/company-a/documents/recent/file.pdf', { timeCreated: new Date().toISOString() });
  const { bucket } = mockAdmin(t, { files: [recent], firestoreError: new Error('must not query') });
  const result = await cleanupOrphanDocumentStorageHandler();
  assert.deepEqual(result, { scanned: 1, quarantined: 0, skipped: 1, dryRun: false });
  assert.equal(recent.moves.length, 0);
  assert.equal(bucket.queries.length, 1);
});

test('non-canonical paths are skipped without Firestore lookup or quarantine', async (t) => {
  setCleanupEnv(t, { ORPHAN_DOCUMENT_CLEANUP_DRY_RUN: 'false' });
  const invalid = file('companies/company-a/private/doc-a/file.pdf');
  mockAdmin(t, { files: [invalid], firestoreError: new Error('must not query') });
  const result = await cleanupOrphanDocumentStorageHandler();
  assert.deepEqual(result, { scanned: 0, quarantined: 0, skipped: 1, dryRun: false });
  assert.equal(invalid.moves.length, 0);
});
