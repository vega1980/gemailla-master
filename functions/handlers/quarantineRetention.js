const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const firebaseAdmin = require('../firebaseAdmin');
const { CLEAN_BUCKET, INFECTED_BUCKET } = require('./quarantineScanner');
const CLEANUP_RETRY_DELAY_MS = 60 * 60 * 1000;
function expectedQuarantinePrefix(data, documentId) { return `companies/${data.companyId}/quarantine/${documentId}/`; }
function validateQuarantineReference(data, documentId, path) {
  if (!data.companyId || !documentId || !path.startsWith(expectedQuarantinePrefix(data, documentId)) || path.length === expectedQuarantinePrefix(data, documentId).length || path.slice(expectedQuarantinePrefix(data, documentId).length).includes('/')) throw new Error('Ruta de cuarentena no corresponde a la empresa o documento.');
}
function validateScannerReference(data, documentId, bucket, path, expectedBucket) {
  if (bucket !== expectedBucket) throw new Error('Bucket de cuarentena inválido.');
  validateQuarantineReference(data, documentId, path);
}
async function cleanupRejectedQuarantine(_event, dependencies = {}) {
  const db = dependencies.firestore || firebaseAdmin.getAdminFirestore(); const storage = dependencies.storage || firebaseAdmin.getAdminStorage(); const bucket = dependencies.bucket || storage.bucket(); const now = dependencies.now || Timestamp.now(); let deleted = 0; let failed = 0;
  while (true) {
    const snapshot = await db.collection('documents').where('scanStatus', 'in', ['rejected', 'scan_error']).where('quarantineExpiresAt', '<=', now).limit(100).get(); if (snapshot.empty) break;
    for (const document of snapshot.docs) { const data = document.data(); const path = String(data.quarantinePath || ''); try { validateQuarantineReference(data, document.id, path); if (!data.scanSourceGeneration) throw new Error('Generación de cuarentena inválida.'); if (data.scannerQuarantineBucket || data.scannerQuarantinePath || data.scannerQuarantineGeneration) { if (!data.scannerQuarantineBucket || !data.scannerQuarantinePath || !data.scannerQuarantineGeneration) throw new Error('Referencia de cuarentena del scanner incompleta.'); validateScannerReference(data, document.id, data.scannerQuarantineBucket, data.scannerQuarantinePath, INFECTED_BUCKET); } await bucket.file(path).delete({ ifGenerationMatch: Number(data.scanSourceGeneration), ignoreNotFound: true }); if (data.scannerQuarantineBucket) await storage.bucket(data.scannerQuarantineBucket).file(data.scannerQuarantinePath).delete({ ifGenerationMatch: Number(data.scannerQuarantineGeneration), ignoreNotFound: true }); await document.ref.update({ quarantinePath: FieldValue.delete(), scannerQuarantineBucket: FieldValue.delete(), scannerQuarantinePath: FieldValue.delete(), scannerQuarantineGeneration: FieldValue.delete(), quarantineExpiresAt: FieldValue.delete(), quarantineDeletedAt: FieldValue.serverTimestamp() }); deleted += 1; } catch (error) { failed += 1; await document.ref.update({ quarantineExpiresAt: Timestamp.fromMillis(now.toMillis() + CLEANUP_RETRY_DELAY_MS), quarantineCleanupError: String(error.message).slice(0, 300), updatedAt: FieldValue.serverTimestamp() }); } }
    if (snapshot.size < 100) break;
  }
  return { deleted, failed };
}
async function retryPromotedCleanup(_event, dependencies = {}) {
  const db = dependencies.firestore || firebaseAdmin.getAdminFirestore(); const storage = dependencies.storage || firebaseAdmin.getAdminStorage(); const appBucket = dependencies.bucket || storage.bucket();
  const snapshot = await db.collection('documents').where('scanStatus', '==', 'clean').where('quarantineCleanupPending', '==', true).limit(100).get(); let cleaned = 0; let failed = 0;
  for (const document of snapshot.docs) {
    const data = document.data();
    try {
      if (!data.quarantinePath || !data.scanSourceGeneration) throw new Error('Referencia de origen incompleta.');
      validateQuarantineReference(data, document.id, data.quarantinePath);
      if (data.scannerCleanBucket || data.scannerCleanPath || data.scannerCleanGeneration) {
        if (!data.scannerCleanBucket || !data.scannerCleanPath || !data.scannerCleanGeneration) throw new Error('Referencia clean del scanner incompleta.');
        validateScannerReference(data, document.id, data.scannerCleanBucket, data.scannerCleanPath, CLEAN_BUCKET);
      }
      await appBucket.file(data.quarantinePath).delete({ ifGenerationMatch: Number(data.scanSourceGeneration), ignoreNotFound: true });
      if (data.scannerCleanBucket && data.scannerCleanPath && data.scannerCleanGeneration) await storage.bucket(data.scannerCleanBucket).file(data.scannerCleanPath).delete({ ifGenerationMatch: Number(data.scannerCleanGeneration), ignoreNotFound: true });
      await document.ref.update({ quarantineCleanupPending: FieldValue.delete(), quarantineCleanupError: FieldValue.delete(), scannerCleanBucket: FieldValue.delete(), scannerCleanPath: FieldValue.delete(), scannerCleanGeneration: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }); cleaned += 1;
    } catch (error) { failed += 1; await document.ref.update({ quarantineCleanupError: String(error.message).slice(0, 300), updatedAt: FieldValue.serverTimestamp() }); }
  }
  return { cleaned, failed, hasMore: snapshot.size === 100 };
}
module.exports = { cleanupRejectedQuarantine, retryPromotedCleanup };
