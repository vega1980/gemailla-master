const admin = require('firebase-admin');

const DEFAULT_SUCCESSFUL_DOCUMENT_STATUSES = ['pending', 'uploaded', 'processing', 'analyzed', 'active'];
const DOCUMENT_STORAGE_PATH_PATTERN = /^companies\/([^/]+)\/documents\/([^/]+)\//;
const DEFAULT_MIN_FILE_AGE_MINUTES = 120;

function getSuccessfulDocumentStatuses() {
  const raw = String(process.env.DOCUMENT_SUCCESSFUL_STATUSES || '').trim();
  if (!raw) return DEFAULT_SUCCESSFUL_DOCUMENT_STATUSES;
  const parsed = raw.split(',').map((status) => status.trim()).filter(Boolean);
  return parsed.length > 0 ? parsed : DEFAULT_SUCCESSFUL_DOCUMENT_STATUSES;
}

function getOrphanCleanupConfig() {
  const dryRunRaw = String(process.env.ORPHAN_DOCUMENT_CLEANUP_DRY_RUN || 'true').toLowerCase();
  return {
    dryRun: dryRunRaw !== 'false',
    maxFiles: Math.max(1, Number(process.env.ORPHAN_DOCUMENT_CLEANUP_MAX_FILES || 500)),
    minFileAgeMinutes: Math.max(5, Number(process.env.ORPHAN_DOCUMENT_CLEANUP_MIN_FILE_AGE_MINUTES || DEFAULT_MIN_FILE_AGE_MINUTES)),
    quarantinePrefix: String(process.env.ORPHAN_DOCUMENT_QUARANTINE_PREFIX || 'quarantine/orphan-documents').replace(/^\/+|\/+$/g, ''),
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
  const { dryRun, maxFiles, minFileAgeMinutes, quarantinePrefix, successfulStatuses } = getOrphanCleanupConfig();
  const db = admin.firestore();
  const bucket = admin.storage().bucket();
  const result = { scanned: 0, quarantined: 0, skipped: 0, dryRun };
  let nextQuery = { prefix: 'companies/', maxResults: Math.min(maxFiles, 1000) };

  while (nextQuery && result.scanned < maxFiles) {
    const [files, queryForNextPage] = await bucket.getFiles(nextQuery);

    for (const file of files) {
      if (result.scanned >= maxFiles) break;
      const parsed = parseDocumentStoragePath(file.name);
      if (!parsed) {
        result.skipped += 1;
        continue;
      }

      result.scanned += 1;
      const [metadata] = await file.getMetadata();
      const createdAtMs = new Date(metadata.timeCreated || metadata.updated || Date.now()).getTime();
      const ageMinutes = (Date.now() - createdAtMs) / 60000;
      if (!Number.isFinite(ageMinutes) || ageMinutes < minFileAgeMinutes) {
        result.skipped += 1;
        continue;
      }

      const hasMetadata = await documentHasSuccessfulMetadata({ db, ...parsed, successfulStatuses });
      if (hasMetadata) {
        result.skipped += 1;
        continue;
      }

      const quarantinePath = `${quarantinePrefix}/${new Date().toISOString().slice(0, 10)}/${file.name}`;
      if (!dryRun) {
        await file.move(quarantinePath);
      }
      result.quarantined += 1;
    }

    nextQuery = queryForNextPage && result.scanned < maxFiles ? queryForNextPage : null;
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
