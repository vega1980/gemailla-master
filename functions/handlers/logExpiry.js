const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const RETENTION_DAYS = Object.freeze({ auditLogs: 2555, aiAuditLogs: 90, aiCostLogs: 90, aiUsage: 90, predictionLogs: 90, observabilityEvents: 90 });
async function assignManagedExpiry(event, collectionName) {
  const snapshot = event.data; const data = snapshot?.data?.() || {};
  if (!snapshot || data.expiresAt !== undefined) return;
  if (data.legalHold === true) { await snapshot.ref.update({ expiresAt: null, expiryAssignedAt: FieldValue.serverTimestamp() }); return; }
  const days = RETENTION_DAYS[collectionName];
  await snapshot.ref.update({ expiresAt: Timestamp.fromMillis(Date.now() + days * 24 * 60 * 60 * 1000), expiryAssignedAt: FieldValue.serverTimestamp() });
}
module.exports = { RETENTION_DAYS, assignManagedExpiry };
