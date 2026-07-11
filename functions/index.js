const admin = require('firebase-admin');
const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');

admin.initializeApp();

const openAiApiKey = defineSecret('OPENAI_API_KEY');
const aiExports = require('./handlers/aiHandler');
const { syncCompanyClaimsHandler } = require('./handlers/syncCompanyClaimsHandler');
const { functionsRouterHandler } = require('./handlers/functionsRouter');
const { cleanupOrphanDocumentStorageHandler } = require('./handlers/orphanDocumentStorageCleanup');
const { revokeMembershipUserRefreshTokens } = require('./handlers/companyMembershipClaimsHandler');
const { acceptCompanyInvitationHandler, inviteCompanyMemberHandler } = require('./handlers/companyInviteHandler');
const { aggregateCompanyMetricsOnWrite } = require('./handlers/companyMetricsAggregationHandler');
const { handleCorsPolicy } = require('./policies/httpPolicy');

exports.ai = onRequest({ cors: false, secrets: [openAiApiKey], timeoutSeconds: 120, memory: '512MiB' }, aiExports.aiHandler);
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

exports._test = {
  ...aiExports,
  syncCompanyClaimsHandler,
  functionsRouterHandler,
  inviteCompanyMemberHandler,
  acceptCompanyInvitationHandler,
  aggregateCompanyMetricsOnWrite,
  cleanupOrphanDocumentStorageHandler,
  revokeMembershipUserRefreshTokens,
};
