import firebase from '@/api/firebaseClient';
import { ensureCorrelationId } from '@/lib/observability';

export async function logAction({ companyId, userEmail, userName, action, entityType, entityId, details, correlationId }) {
  try {
    const normalizedCorrelationId = ensureCorrelationId(correlationId, 'audit');
    await firebase.functions.invoke('appendAuditLog', {
      companyId: companyId || '',
      action: 'client_activity',
      entity_type: entityType || '',
      entity_id: entityId || '',
      details: `${action}: ${details || ''}`.slice(0, 1000),
      correlationId: normalizedCorrelationId,
    });
  } catch (error) {
    console.error('[auditLogger] No se pudo registrar la auditoria:', error);
  }
}
