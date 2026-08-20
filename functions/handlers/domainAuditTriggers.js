const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const firebaseAdmin = require('../firebaseAdmin');
const ACTIONS = Object.freeze({ companies: 'company_create', companyMembers: 'member_add', transactions: 'transaction_create' });
async function createOnce(ref, payload) { try { await ref.create(payload); } catch (error) { if (error.code !== 6 && error.code !== 'already-exists') throw error; } }
async function recordAuthoritativeEvent(event, collectionName) {
  const data = event.data?.data?.() || {};
  const companyId = collectionName === 'companies' ? event.params.documentId : data.companyId;
  if (!companyId) return;
  const id = `backend_${event.id}`.replace(/[^A-Za-z0-9_-]/g, '_');
  await createOnce(firebaseAdmin.getAdminFirestore().collection('auditLogs').doc(id), { companyId, action: ACTIONS[collectionName], entity_type: collectionName, entity_id: event.params.documentId, authoritative: true, source: 'firestore_trigger', eventId: event.id, createdAt: FieldValue.serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000), immutable: true });
}
async function recordDocumentAnalyzed(event) {
  const before = event.data?.before?.data?.() || {}; const after = event.data?.after?.data?.() || {};
  if (before.status === 'analyzed' || after.status !== 'analyzed' || !after.companyId) return;
  const id = `backend_${event.id}`.replace(/[^A-Za-z0-9_-]/g, '_');
  await createOnce(firebaseAdmin.getAdminFirestore().collection('auditLogs').doc(id), { companyId: after.companyId, action: 'document_analyze', entity_type: 'documents', entity_id: event.params.documentId, authoritative: true, source: 'firestore_trigger', eventId: event.id, createdAt: FieldValue.serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000), immutable: true });
}
module.exports = { createOnce, recordAuthoritativeEvent, recordDocumentAnalyzed };
