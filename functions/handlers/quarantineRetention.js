const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const firebaseAdmin = require('../firebaseAdmin');
const CLEANUP_RETRY_DELAY_MS = 60 * 60 * 1000;
async function cleanupRejectedQuarantine(_event, dependencies = {}) {
  const db = dependencies.firestore || firebaseAdmin.getAdminFirestore(); const bucket = dependencies.bucket || firebaseAdmin.getAdminStorage().bucket(); const now = dependencies.now || Timestamp.now(); let deleted = 0; let failed = 0;
  while (true) {
    const snapshot = await db.collection('documents').where('scanStatus', 'in', ['rejected', 'scan_error']).where('quarantineExpiresAt', '<=', now).limit(100).get(); if (snapshot.empty) break;
    for (const document of snapshot.docs) { const path = String(document.data().quarantinePath || ''); try { if (!/^companies\/[^/]+\/quarantine\/[^/]+\/[^/]+$/.test(path)) throw new Error('Ruta de cuarentena inválida.'); await bucket.file(path).delete({ ignoreNotFound: true }); await document.ref.update({ quarantinePath: FieldValue.delete(), quarantineExpiresAt: FieldValue.delete(), quarantineDeletedAt: FieldValue.serverTimestamp() }); deleted += 1; } catch (error) { failed += 1; await document.ref.update({ quarantineExpiresAt: Timestamp.fromMillis(now.toMillis() + CLEANUP_RETRY_DELAY_MS), quarantineCleanupError: String(error.message).slice(0, 300), updatedAt: FieldValue.serverTimestamp() }); } }
    if (snapshot.size < 100) break;
  }
  return { deleted, failed };
}
async function retryQuarantineScanErrors(_event, dependencies = {}) {
  const db = dependencies.firestore || firebaseAdmin.getAdminFirestore(); const bucket = dependencies.bucket || firebaseAdmin.getAdminStorage().bucket(); const scanner = dependencies.scanner; const now = dependencies.now || Timestamp.now(); const snapshot = await db.collection('documents').where('scanStatus', '==', 'scan_error').where('scanLeaseUntil', '<=', now).limit(100).get(); let retried = 0;
  for (const document of snapshot.docs) { const path = String(document.data().quarantinePath || ''); if (!path) continue; const [metadata] = await bucket.file(path).getMetadata(); await scanner({ id: `retry-${document.id}-${metadata.generation}`, data: { ...metadata, name: path, bucket: bucket.name, metadata: metadata.metadata || {} } }); retried += 1; }
  return { retried, hasMore: snapshot.size === 100 };
}
module.exports = { cleanupRejectedQuarantine, retryQuarantineScanErrors };
