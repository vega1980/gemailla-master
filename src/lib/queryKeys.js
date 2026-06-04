export const queryKeys = Object.freeze({
  companies: (userId) => ['companies', userId || 'anonymous'],
  companyMembers: (companyId) => ['company-members', companyId || 'none'],
  documents: (companyId) => ['documents', companyId || 'none'],
  transactions: (companyId) => ['transactions', companyId || 'none'],
  auditLogs: (companyId) => ['audit-logs', companyId || 'none'],
  subscriptions: (userId) => ['subscriptions', userId || 'anonymous'],
  predictionLogs: (userId) => ['prediction-logs', userId || 'anonymous'],
});
