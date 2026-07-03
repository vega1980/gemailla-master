const admin = require('firebase-admin');

const DEFAULT_SUCCESSFUL_DOCUMENT_STATUSES = ['pending', 'uploaded', 'processing', 'analyzed', 'active'];
const DOCUMENT_STORAGE_PATH_PATTERN = /^companies\/([^/]+)\/documents\/([^/]+)\//;

function getSuccessfulDocumentStatuses() {
  const raw = String(process.env.DOCUMENT_SUCCESSFUL_STATUSES || '').trim();
  if (!raw) return DEFAULT_SUCCESSFUL_DOCUMENT_STATUSES;
  const parsed = raw.split(',').map((status) => status.trim()).filter(Boolean);
  return parsed.length > 0 ? parsed : DEFAULT_SUCCESSFUL_DOCUMENT_STATUSES;
}

function getOrphanCleanupConfig() {
  return {
    dryRun: String(process.env.ORPHAN_DOCUMENT_CLEANUP_DRY_RUN || '').toLowerCase() === 'true',
    maxFiles: Math.max(1, Number(process.env.ORPHAN_DOCUMENT_CLEANUP_MAX_FILES || 500)),
    successfulStatuses: new Set(getSuccessfulDocumentStatuses()),
  };
}

function parseDocumentStoragePath(path = '') {
  const match = String(path).match(DOCUMENT_STORAGE_PATH_PATTERN);
  if (!match) return null;
  return { companyId: match[1], documentId: match[2] };
}

async function documentHasSuccessfulMetadata({ db, companyId, documentId, successfulStatuses }) {
  const snap = await db.collection('documents').doc(documentId).get();
  if (!snap.exists) return false;
  const data = snap.data() || {};
  return data.companyId === companyId && successfulStatuses.has(String(data.status || ''));
}

async function cleanupOrphanDocumentStorageHandler(_event = {}) {
  const { dryRun, maxFiles, successfulStatuses } = getOrphanCleanupConfig();
  const db = admin.firestore();
  const bucket = admin.storage().bucket();
  const [files] = await bucket.getFiles({ prefix: 'companies/', maxResults: maxFiles });
  const result = { scanned: 0, deleted: 0, skipped: 0, dryRun };

  for (const file of files) {
    const parsed = parseDocumentStoragePath(file.name);
    if (!parsed) {
      result.skipped += 1;
      continue;
    }

    result.scanned += 1;
    const hasMetadata = await documentHasSuccessfulMetadata({ db, ...parsed, successfulStatuses });
    if (hasMetadata) {
      result.skipped += 1;
      continue;
    }

    if (!dryRun) await file.delete({ ignoreNotFound: true });
    result.deleted += 1;
  }

  console.log(JSON.stringify({ eventName: 'orphan_document_storage_cleanup_completed', ...result }));
  return result;
}

module.exports = {
  cleanupOrphanDocumentStorageHandler,
  parseDocumentStoragePath,
  getOrphanCleanupConfig,
  documentHasSuccessfulMetadata,
};
