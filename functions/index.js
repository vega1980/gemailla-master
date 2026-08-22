const firebaseAdmin = require('./firebaseAdmin');
const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentCreated, onDocumentUpdated, onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onObjectFinalized } = require('firebase-functions/v2/storage');

firebaseAdmin.initializeAdminApp();

function configuredStorageBucket() {
  try { return JSON.parse(process.env.FIREBASE_CONFIG || '{}').storageBucket; } catch { return null; }
}

const aiExports = require('./handlers/aiHandler');
const { syncCompanyClaimsHandler } = require('./handlers/syncCompanyClaimsHandler');
const { functionsRouterHandler } = require('./handlers/functionsRouter');
const { cleanupOrphanDocumentStorageHandler } = require('./handlers/orphanDocumentStorageCleanup');
const { revokeMembershipUserRefreshTokens } = require('./handlers/companyMembershipClaimsHandler');
const { acceptCompanyInvitationHandler, inviteCompanyMemberHandler } = require('./handlers/companyInviteHandler');
const { aggregateCompanyMetricsOnWrite } = require('./handlers/companyMetricsAggregationHandler');
const { handleCorsPolicy } = require('./policies/httpPolicy');
const { CLEAN_BUCKET, INFECTED_BUCKET, cleanScannerResultHandler, infectedScannerResultHandler, quarantineScannerHandler } = require('./handlers/quarantineScanner');
const { recordAuthoritativeEvent, recordDocumentAnalyzed } = require('./handlers/domainAuditTriggers');
const { assignManagedExpiry } = require('./handlers/logExpiry');
const { cleanupRejectedQuarantine, retryPromotedCleanup } = require('./handlers/quarantineRetention');

exports.ai = onRequest({ cors: false, timeoutSeconds: 120, memory: '512MiB' }, aiExports.aiHandler);
exports.syncCompanyClaims = onRequest({ cors: false }, (req, res) => {
  if (handleCorsPolicy(req, res)) return;
  return syncCompanyClaimsHandler(req, res);
});
exports.functionsRouter = onRequest({ cors: false }, functionsRouterHandler);
exports.cleanupOrphanDocumentStorage = onSchedule({ schedule: 'every sunday 03:00', timeZone: 'Etc/UTC' }, cleanupOrphanDocumentStorageHandler);
exports.revokeMembershipClaimsOnWrite = onDocumentWritten('companyMembers/{memberId}', revokeMembershipUserRefreshTokens);
exports.aggregateMetricsOnTransactionWrite = onDocumentWritten('transactions/{transactionId}', aggregateCompanyMetricsOnWrite);
exports.aggregateMetricsOnDocumentWrite = onDocumentWritten('documents/{documentId}', aggregateCompanyMetricsOnWrite);
exports.aggregateMetricsOnKpiWrite = onDocumentWritten('kpis/{kpiId}', aggregateCompanyMetricsOnWrite);
exports.scanQuarantinedDocument = onObjectFinalized({ bucket: configuredStorageBucket() || `${process.env.GCLOUD_PROJECT || 'demo-gemailla-test'}.appspot.com`, timeoutSeconds: 60, memory: '512MiB', retry: true }, quarantineScannerHandler);
exports.finalizeCleanDocument = onObjectFinalized({ bucket: CLEAN_BUCKET, timeoutSeconds: 120, memory: '512MiB', retry: true }, cleanScannerResultHandler);
exports.finalizeRejectedDocument = onObjectFinalized({ bucket: INFECTED_BUCKET, timeoutSeconds: 60, memory: '512MiB', retry: true }, infectedScannerResultHandler);
exports.cleanupRejectedQuarantine = onSchedule({ schedule: 'every day 04:00', timeZone: 'Etc/UTC' }, cleanupRejectedQuarantine);
exports.retryPromotedCleanup = onSchedule({ schedule: 'every 15 minutes', timeZone: 'Etc/UTC' }, retryPromotedCleanup);
exports.auditCompanyCreated = onDocumentCreated('companies/{documentId}', event => recordAuthoritativeEvent(event, 'companies'));
exports.auditMemberCreated = onDocumentCreated('companyMembers/{documentId}', event => recordAuthoritativeEvent(event, 'companyMembers'));
exports.auditTransactionCreated = onDocumentCreated('transactions/{documentId}', event => recordAuthoritativeEvent(event, 'transactions'));
exports.auditDocumentAnalyzed = onDocumentUpdated('documents/{documentId}', recordDocumentAnalyzed);
for (const collectionName of ['auditLogs', 'aiAuditLogs', 'aiCostLogs', 'aiUsage', 'predictionLogs', 'observabilityEvents']) {
  exports[`assignExpiry_${collectionName}`] = onDocumentCreated(`${collectionName}/{documentId}`, event => assignManagedExpiry(event, collectionName));
}

exports._test = {
  ...aiExports,
  syncCompanyClaimsHandler,
  functionsRouterHandler,
  inviteCompanyMemberHandler,
  acceptCompanyInvitationHandler,
  aggregateCompanyMetricsOnWrite,
  cleanupOrphanDocumentStorageHandler,
  revokeMembershipUserRefreshTokens,
  quarantineScannerHandler,
};
