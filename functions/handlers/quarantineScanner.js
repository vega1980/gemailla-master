const { createHash } = require('node:crypto');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const firebaseAdmin = require('../firebaseAdmin');

const QUARANTINE_PATH = /^companies\/([^/]+)\/quarantine\/([^/]+)\/([^/]+)$/;
const MAX_BYTES = 15 * 1024 * 1024;
const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
const UNSCANNED_BUCKET = 'unscanned-gemailla-enterprise';
const CLEAN_BUCKET = 'clean-gemailla-enterprise';
const INFECTED_BUCKET = 'quarantined-gemailla-enterprise';

function declaredType(fileName, contentType) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf') && contentType === 'application/pdf') return 'pdf';
  if (lower.endsWith('.xml') && ['application/xml', 'text/xml'].includes(contentType)) return 'xml';
  return null;
}
function infectedError(message) { const error = new Error(message); error.infected = true; return error; }
function validateContent(buffer, fileName, contentType) {
  const type = declaredType(fileName, contentType);
  if (!type) throw new Error('Extensión y MIME no coinciden.');
  if (buffer.includes(Buffer.from(EICAR))) throw infectedError('Firma EICAR detectada.');
  if (type === 'pdf' && buffer.subarray(0, 5).toString() !== '%PDF-') throw new Error('Firma PDF inválida.');
  if (type === 'xml') {
    const xml = buffer.toString('utf8');
    if (!(xml.trimStart().startsWith('<?xml') || xml.trimStart().startsWith('<'))) throw new Error('Firma XML inválida.');
    if (/<!DOCTYPE|<!ENTITY|\bSYSTEM\b|\bPUBLIC\b/i.test(xml)) throw new Error('XML inseguro.');
  }
  return type;
}
function eventObject(event) { return event.data || event; }
function objectIdentity(object) { return `${object.bucket}/${object.name}#${object.generation}`; }
function parsePath(name) {
  const match = String(name || '').match(QUARANTINE_PATH);
  return match ? { companyId: match[1], documentId: match[2], fileName: match[3] } : null;
}
function metadataMatches(metadata, expected) {
  return Object.entries(expected).every(([key, value]) => String(metadata?.[key] || '') === String(value));
}
function getStorage(dependencies) { return dependencies.storage || firebaseAdmin.getAdminStorage(); }
function logScanDecision(eventName, details) {
  console.info(JSON.stringify({ eventName, ...details }));
}

async function setScanError(documentRef, expected, message, dependencies = {}) {
  const firestore = dependencies.firestore || firebaseAdmin.getAdminFirestore();
  const now = dependencies.now || Timestamp.now();
  return firestore.runTransaction(async transaction => {
    const snapshot = await transaction.get(documentRef);
    if (!snapshot.exists) return false;
    const data = snapshot.data() || {};
    if (['clean', 'rejected'].includes(data.scanStatus)) return false;
    if (expected.companyId && data.companyId !== expected.companyId) return false;
    if (expected.sourceIdentity && data.scanSourceIdentity !== expected.sourceIdentity) return false;
    if (expected.sourceObject && data.scanSourceObject !== expected.sourceObject) return false;
    transaction.update(documentRef, {
      status: 'quarantined', scanStatus: 'scan_error', scanError: String(message).slice(0, 300),
      quarantineExpiresAt: Timestamp.fromMillis(now.toMillis() + 7 * 86400000),
      scannedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
}

async function quarantineScannerHandler(event, dependencies = {}) {
  const object = eventObject(event); const parsed = parsePath(object.name);
  if (!parsed) {
    logScanDecision('malware_scan_input_decision', { bucket: object.bucket, generation: String(object.generation || ''), accepted: false, reason: 'path' });
    return { ignored: true };
  }
  const { companyId, documentId, fileName } = parsed; const generation = String(object.generation || '');
  const firestore = dependencies.firestore || firebaseAdmin.getAdminFirestore(); const storage = getStorage(dependencies);
  const sourceBucket = dependencies.sourceBucket || storage.bucket(object.bucket);
  const unscannedBucket = dependencies.unscannedBucket || storage.bucket(UNSCANNED_BUCKET);
  const source = sourceBucket.file(object.name, { generation }); const unscanned = unscannedBucket.file(object.name);
  const documentRef = firestore.collection('documents').doc(documentId);
  let claimed = false; let identity;
  try {
    if (!object.bucket || !generation) throw new Error('Identidad del objeto incompleta.');
    if (Number(object.size) <= 0 || Number(object.size) >= MAX_BYTES) throw new Error('Tamaño inválido.');
    if (!declaredType(fileName, object.contentType)) throw new Error('Extensión y MIME no coinciden.');
    if (object.metadata?.companyId !== companyId || object.metadata?.documentId !== documentId) throw new Error('Metadata de tenant inválida.');
    const [buffer] = await source.download({ ifGenerationMatch: Number(generation) });
    const sha256 = createHash('sha256').update(buffer).digest('hex');
    let validationError; try { validateContent(buffer, fileName, object.contentType); } catch (error) { validationError = error; }
    identity = objectIdentity(object); const nowMs = dependencies.nowMs || Date.now();
    const claim = await firestore.runTransaction(async transaction => {
      const snapshot = await transaction.get(documentRef);
      if (!snapshot.exists || snapshot.data().companyId !== companyId) throw new Error('Documento asociado inválido.');
      const data = snapshot.data();
      if (['clean', 'rejected'].includes(data.scanStatus)) return 'terminal';
      if (data.scanStatus === 'processing') return data.scanSourceIdentity === identity ? 'repeated' : 'busy';
      if (data.scanStatus && data.scanStatus !== 'quarantined') return 'invalid';
      transaction.update(documentRef, {
        status: 'quarantined', scanStatus: 'processing', scanSourceBucket: String(object.bucket),
        scanSourceObject: String(object.name), scanSourceGeneration: generation, scanSourceIdentity: identity,
        scanHash: sha256, scanLeaseUntil: Timestamp.fromMillis(nowMs + 15 * 60 * 1000),
        scanStartedAt: FieldValue.serverTimestamp(), scanError: FieldValue.delete(),
        scanResultOutcome: FieldValue.delete(), scanResultBucket: FieldValue.delete(),
        scanResultObject: FieldValue.delete(), scanResultGeneration: FieldValue.delete(),
        quarantinePath: String(object.name), updatedAt: FieldValue.serverTimestamp(),
      });
      return 'claimed';
    });
    logScanDecision('malware_scan_input_decision', {
      bucket: object.bucket, generation, companyId, documentId,
      previousState: claim === 'claimed' ? 'quarantined' : undefined,
      requestedTransition: 'processing', accepted: claim === 'claimed' || claim === 'repeated', reason: claim,
    });
    if (claim === 'terminal') return { ignored: true, terminal: true };
    if (claim === 'busy') return { dispatched: false, busy: true };
    if (claim === 'invalid') return { dispatched: false, invalidTransition: true };
    claimed = true;
    if (validationError) throw validationError;
    const correlation = { companyId, documentId, sourceBucket: String(object.bucket), sourceObject: String(object.name), sourceGeneration: generation, sourceIdentity: identity, sha256 };
    const [exists] = await unscanned.exists();
    if (exists) {
      const [existing] = await unscanned.getMetadata();
      if (!metadataMatches(existing.metadata, correlation)) throw new Error('Entrada de escaneo preexistente no verificable.');
    } else {
      await source.copy(unscanned, { preconditionOpts: { ifGenerationMatch: 0 }, contentType: object.contentType, metadata: correlation });
    }
    const [dispatchedMetadata] = await unscanned.getMetadata();
    logScanDecision('malware_scan_input_dispatched', {
      bucket: unscannedBucket.name,
      generation: String(dispatchedMetadata.generation || ''), companyId, documentId,
      metadataPreserved: metadataMatches(dispatchedMetadata.metadata, correlation),
    });
    return { dispatched: true, repeated: claim === 'repeated', identity, sha256 };
  } catch (error) {
    if (claimed) {
      await setScanError(documentRef, { companyId, sourceIdentity: identity }, error.message, { ...dependencies, firestore });
      if (error.infected) await firestore.runTransaction(async transaction => {
        const snapshot = await transaction.get(documentRef); const data = snapshot.data() || {};
        if (data.scanStatus !== 'scan_error' || data.scanSourceIdentity !== identity) return;
        transaction.update(documentRef, { scanStatus: 'rejected', scanError: error.message, quarantineExpiresAt: Timestamp.fromMillis(Date.now() + 30 * 86400000), scannedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      });
    }
    console.error(JSON.stringify({ eventName: 'quarantine_scan_dispatch_failed', companyId, documentId, reason: String(error.message).slice(0, 300) }));
    return { dispatched: false, infected: Boolean(error.infected), reason: error.message };
  }
}

async function scannerResultHandler(event, outcome, dependencies = {}) {
  const object = eventObject(event); const expectedBucket = outcome === 'clean' ? CLEAN_BUCKET : INFECTED_BUCKET;
  if (object.bucket !== expectedBucket) {
    logScanDecision('malware_scan_result_decision', { bucket: object.bucket, generation: String(object.generation || ''), outcome, accepted: false, reason: 'wrong_bucket' });
    return { ignored: true, wrongBucket: true };
  }
  const parsed = parsePath(object.name); if (!parsed) return { ignored: true };
  const { companyId, documentId, fileName } = parsed; const metadata = object.metadata || {};
  const firestore = dependencies.firestore || firebaseAdmin.getAdminFirestore(); const storage = getStorage(dependencies);
  const resultBucket = dependencies.resultBucket || storage.bucket(object.bucket);
  const appBucket = dependencies.appBucket || storage.bucket(metadata.sourceBucket);
  const resultFile = resultBucket.file(object.name, { generation: String(object.generation || '') }); const sourceFile = appBucket.file(metadata.sourceObject || object.name);
  const documentRef = firestore.collection('documents').doc(documentId);
  const sourceIdentity = `${metadata.sourceBucket}/${metadata.sourceObject}#${metadata.sourceGeneration}`;
  const resultGeneration = String(object.generation || '');
  const required = { companyId, documentId, sourceIdentity, sha256: metadata.sha256 };
  if (!metadata.sourceBucket || !metadata.sourceObject || !metadata.sourceGeneration || !metadata.sha256 || !metadataMatches(metadata, required)) {
    logScanDecision('malware_scan_result_decision', {
      bucket: object.bucket, generation: String(object.generation || ''), companyId, documentId,
      outcome, requestedTransition: outcome, accepted: false, reason: 'metadata',
    });
    await setScanError(documentRef, { companyId, sourceObject: object.name }, 'Resultado con metadatos de correlación inválidos.', { ...dependencies, firestore });
    return { finalized: false, reason: 'metadata' };
  }
  try {
    const [buffer] = await resultFile.download({ ifGenerationMatch: Number(object.generation) });
    const actualHash = createHash('sha256').update(buffer).digest('hex');
    if (actualHash !== metadata.sha256) throw new Error('Hash del resultado no coincide.');
    const eligibility = await firestore.runTransaction(async transaction => {
      const snapshot = await transaction.get(documentRef);
      if (!snapshot.exists || snapshot.data().companyId !== companyId) return 'foreign';
      const data = snapshot.data();
      if (data.scanStatus === outcome && data.scanSourceIdentity === sourceIdentity) return 'repeated';
      if (['clean', 'rejected'].includes(data.scanStatus)) return 'terminal';
      if (data.scanStatus !== 'processing') return 'invalid';
      if (data.scanSourceIdentity !== sourceIdentity || data.scanHash !== actualHash) return 'stale';
      if (data.scanResultOutcome) {
        const sameResult = data.scanResultOutcome === outcome
          && data.scanResultBucket === object.bucket
          && data.scanResultObject === object.name
          && data.scanResultGeneration === resultGeneration;
        return sameResult ? 'eligible' : 'conflict';
      }
      transaction.update(documentRef, {
        scanResultOutcome: outcome, scanResultBucket: object.bucket,
        scanResultObject: object.name, scanResultGeneration: resultGeneration,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return 'eligible';
    });
    logScanDecision('malware_scan_result_decision', {
      bucket: object.bucket, generation: String(object.generation || ''), companyId, documentId,
      previousState: eligibility === 'eligible' ? 'processing' : undefined,
      requestedTransition: outcome, outcome, accepted: eligibility === 'eligible' || eligibility === 'repeated', reason: eligibility,
    });
    if (eligibility !== 'eligible') return { finalized: eligibility === 'repeated', repeated: eligibility === 'repeated', ignored: true, reason: eligibility };
    if (outcome === 'rejected') {
      const finalization = await firestore.runTransaction(async transaction => {
        const snapshot = await transaction.get(documentRef); const data = snapshot.data() || {};
        if (data.scanStatus === 'rejected' && data.scanSourceIdentity === sourceIdentity) return 'repeated';
        if (['clean', 'rejected'].includes(data.scanStatus)) return 'terminal';
        if (data.scanStatus !== 'processing') return 'invalid_transition';
        if (data.scanSourceIdentity !== sourceIdentity || data.scanHash !== actualHash) return 'stale';
        if (data.scanResultOutcome !== outcome || data.scanResultBucket !== object.bucket || data.scanResultObject !== object.name || data.scanResultGeneration !== resultGeneration) return 'conflict';
        transaction.update(documentRef, { status: 'quarantined', scanStatus: 'rejected', scannerQuarantineBucket: object.bucket, scannerQuarantinePath: object.name, scannerQuarantineGeneration: String(object.generation), quarantineExpiresAt: Timestamp.fromMillis(Date.now() + 30 * 86400000), scannedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        return 'applied';
      });
      if (finalization !== 'applied') {
        logScanDecision('malware_scan_result_finalization', {
          bucket: object.bucket, generation: resultGeneration, companyId, documentId,
          requestedTransition: 'rejected', accepted: finalization === 'repeated', reason: finalization,
        });
        return { finalized: finalization === 'repeated', repeated: finalization === 'repeated', ignored: true, reason: finalization };
      }
      logScanDecision('malware_scan_firestore_updated', { companyId, documentId, previousState: 'processing', state: 'rejected' });
      return { finalized: true, infected: true };
    }
    const destination = `companies/${companyId}/documents/${documentId}/${fileName}`; const destinationFile = appBucket.file(destination);
    const destinationMetadata = { companyId, documentId, sourceIdentity, sha256: actualHash };
    const [destinationExists] = await destinationFile.exists();
    if (destinationExists) {
      const [existing] = await destinationFile.getMetadata();
      if (!metadataMatches(existing.metadata, destinationMetadata)) throw new Error('Destino preexistente no verificable.');
    } else await resultFile.copy(destinationFile, { preconditionOpts: { ifGenerationMatch: 0 }, contentType: object.contentType, metadata: destinationMetadata });
    await firestore.runTransaction(async transaction => {
      const snapshot = await transaction.get(documentRef); const data = snapshot.data() || {};
      if (data.scanStatus === 'clean' && data.scanSourceIdentity === sourceIdentity) return;
      if (data.scanStatus !== 'processing' || data.scanSourceIdentity !== sourceIdentity || data.scanHash !== actualHash || data.scanResultOutcome !== outcome || data.scanResultBucket !== object.bucket || data.scanResultObject !== object.name || data.scanResultGeneration !== resultGeneration) throw new Error('Transición clean inválida.');
      transaction.update(documentRef, { status: 'uploaded', storagePath: destination, scanStatus: 'clean', scanError: FieldValue.delete(), scannedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    });
    logScanDecision('malware_scan_firestore_updated', { companyId, documentId, previousState: 'processing', state: 'clean', status: 'uploaded' });
    const cleanupErrors = [];
    for (const [file, generation] of [[sourceFile, metadata.sourceGeneration], [resultFile, object.generation]]) {
      try { await file.delete({ ifGenerationMatch: Number(generation) }); } catch (error) { cleanupErrors.push(error.message); }
    }
    if (cleanupErrors.length) await documentRef.update({
      quarantineCleanupPending: true,
      quarantineCleanupError: cleanupErrors.join('; ').slice(0, 300),
      scannerCleanBucket: object.bucket,
      scannerCleanPath: object.name,
      scannerCleanGeneration: String(object.generation),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { finalized: true, destination, cleanupPending: cleanupErrors.length > 0 };
  } catch (error) {
    await setScanError(documentRef, { companyId, sourceIdentity }, error.message, { ...dependencies, firestore });
    console.error(JSON.stringify({ eventName: 'malware_scan_result_failed', outcome, companyId, documentId, reason: String(error.message).slice(0, 300) }));
    return { finalized: false, reason: error.message };
  }
}
const cleanScannerResultHandler = (event, dependencies) => scannerResultHandler(event, 'clean', dependencies);
const infectedScannerResultHandler = (event, dependencies) => scannerResultHandler(event, 'rejected', dependencies);

module.exports = { CLEAN_BUCKET, EICAR, INFECTED_BUCKET, MAX_BYTES, UNSCANNED_BUCKET, cleanScannerResultHandler, declaredType, infectedScannerResultHandler, objectIdentity, quarantineScannerHandler, scannerResultHandler, validateContent };
