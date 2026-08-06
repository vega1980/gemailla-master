import { ensureCorrelationId, getReleaseMetadata, logFrontendEvent } from '@/lib/observability';

export async function logAction({ companyId, userEmail, userName, action, entityType, entityId, details, correlationId }) {
  const normalizedCorrelationId = ensureCorrelationId(correlationId, 'audit');
  logFrontendEvent('audit_log_client_skipped', {
    correlationId: normalizedCorrelationId,
    companyId: companyId || '',
    userEmail: userEmail || '',
    userName: userName || '',
    action,
    entityType: entityType || '',
    entityId: entityId || '',
    details: details || '',
    release: getReleaseMetadata(),
    reason: 'auditLogs_write_blocked_in_firestore_rules',
  }, 'info');
}
