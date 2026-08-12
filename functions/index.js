const firebaseAdmin = require('./firebaseAdmin');
const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');

firebaseAdmin.initializeAdminApp();

const aiExports = require('./handlers/aiHandler');
const { syncCompanyClaimsHandler } = require('./handlers/syncCompanyClaimsHandler');
const { functionsRouterHandler } = require('./handlers/functionsRouter');
const { cleanupOrphanDocumentStorageHandler } = require('./handlers/orphanDocumentStorageCleanup');
const { revokeMembershipUserRefreshTokens } = require('./handlers/companyMembershipClaimsHandler');
const { acceptCompanyInvitationHandler, inviteCompanyMemberHandler } = require('./handlers/companyInviteHandler');
const { aggregateCompanyMetricsOnWrite } = require('./handlers/companyMetricsAggregationHandler');
const { enforceAppCheckPolicy } = require('./policies/appCheckPolicy');
const { handleCorsPolicy } = require('./policies/httpPolicy');

function withAppCheck(handler) {
  return async (req, res) => {
    // Each handler keeps ownership of CORS/OPTIONS. App Check is evaluated only
    // for actual application requests so browser preflight remains unaffected.
    if (req.method !== 'OPTIONS' && await enforceAppCheckPolicy(req, res)) return;
    return handler(req, res);
  };
}

exports.ai = onRequest({ cors: false, timeoutSeconds: 120, memory: '512MiB' }, withAppCheck(aiExports.aiHandler));
exports.syncCompanyClaims = onRequest({ cors: false }, withAppCheck((req, res) => {
  if (handleCorsPolicy(req, res)) return;
  return syncCompanyClaimsHandler(req, res);
}));
exports.functionsRouter = onRequest({ cors: false }, withAppCheck(functionsRouterHandler));
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
  withAppCheck,
};
