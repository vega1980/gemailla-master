const assert = require('node:assert/strict');
const test = require('node:test');
const { createHash } = require('node:crypto');
const {
  CLEAN_BUCKET, EICAR, INFECTED_BUCKET, MAX_BYTES,
  cleanScannerResultHandler, infectedScannerResultHandler, quarantineScannerHandler, validateContent,
} = require('../handlers/quarantineScanner');

const bytes = Buffer.from('%PDF-1.7 safe');
const sha256 = createHash('sha256').update(bytes).digest('hex');
const path = 'companies/acme/quarantine/doc/a.pdf';
const sourceIdentity = `app-bucket/${path}#7`;
const sourceEvent = (overrides = {}) => ({ data: { bucket: 'app-bucket', name: path, generation: '7', size: String(bytes.length), contentType: 'application/pdf', metadata: { companyId: 'acme', documentId: 'doc' }, ...overrides } });
const resultEvent = (bucket, overrides = {}) => ({ data: { bucket, name: path, generation: '11', size: String(bytes.length), contentType: 'application/pdf', metadata: { companyId: 'acme', documentId: 'doc', sourceBucket: 'app-bucket', sourceObject: path, sourceGeneration: '7', sourceIdentity, sha256 }, ...overrides } });

function harness(initial = { companyId: 'acme', status: 'quarantined', scanStatus: 'quarantined' }, options = {}) {
  let data = initial; let transactionCount = 0; let transactionTail = Promise.resolve();
  const calls = { copies: [], deletes: [], downloads: [], fileHandles: [], updates: [] }; const files = new Map();
  const makeFile = (bucket, name, fileOptions) => {
    const key = `${bucket}/${name}`;
    calls.fileHandles.push({ key, options: fileOptions });
    if (files.has(key)) return files.get(key);
    const state = { exists: Boolean(options.existing?.[key]), metadata: options.metadata?.[key] || {}, buffer: options.buffers?.[key] || bytes };
    const file = {
      exists: async () => [state.exists],
      getMetadata: async () => [{ metadata: state.metadata }],
      download: async opts => { calls.downloads.push({ key, opts }); return [state.buffer]; },
      copy: async (destination, opts) => {
        calls.copies.push({ from: key, to: destination.key, opts });
        if (options.copyFails) throw new Error('copy failed');
        destination.state.exists = true; destination.state.buffer = state.buffer; destination.state.metadata = opts.metadata;
      },
      delete: async opts => { calls.deletes.push({ key, opts }); if (options.deleteFails?.includes(key)) throw new Error('delete failed'); state.exists = false; },
      key, state,
    };
    files.set(key, file); return file;
  };
  const storage = { bucket: name => ({ name, file: (objectName, fileOptions) => makeFile(name, objectName, fileOptions) }) };
  const ref = { update: async patch => { data = { ...data, ...patch }; calls.updates.push(patch); } };
  const firestore = {
    collection: () => ({ doc: () => ref }),
    runTransaction: async callback => {
      const execute = async () => {
        transactionCount += 1;
        const result = await callback({
          get: async () => ({ exists: data !== null, data: () => data }),
          update: (_ref, patch) => { data = { ...data, ...patch }; calls.updates.push(patch); },
        });
        await options.afterTransaction?.({ count: transactionCount, result, data: () => data, setData: next => { data = next; } });
        return result;
      };
      const transaction = transactionTail.then(execute, execute);
      transactionTail = transaction.catch(() => {});
      return transaction;
    },
  };
  return { calls, data: () => data, dependencies: { firestore, storage, nowMs: 1000 }, file: makeFile };
}

test('valida EICAR, MIME, tamaño y XML inseguro', async () => {
  assert.throws(() => validateContent(Buffer.from(`%PDF-${EICAR}`), 'a.pdf', 'application/pdf'), /EICAR/);
  assert.throws(() => validateContent(Buffer.from('fake'), 'a.pdf', 'application/pdf'), /Firma PDF/);
  assert.throws(() => validateContent(Buffer.from('<?xml?><!DOCTYPE x>'), 'a.xml', 'application/xml'), /XML inseguro/);
  const h = harness(); await quarantineScannerHandler(sourceEvent({ size: MAX_BYTES }), h.dependencies); assert.equal(h.calls.copies.length, 0);
  const pdfAsXml = harness(); await quarantineScannerHandler(sourceEvent({ contentType: 'application/xml' }), pdfAsXml.dependencies); assert.equal(pdfAsXml.calls.copies.length, 0);
  const xmlAsPdf = harness(); await quarantineScannerHandler(sourceEvent({ name: 'companies/acme/quarantine/doc/a.xml', contentType: 'application/pdf' }), xmlAsPdf.dependencies); assert.equal(xmlAsPdf.calls.copies.length, 0);
});

test('envío a unscanned es idempotente ante evento duplicado', async () => {
  const h = harness(); const first = await quarantineScannerHandler(sourceEvent(), h.dependencies); const second = await quarantineScannerHandler(sourceEvent(), h.dependencies);
  assert.equal(first.dispatched, true); assert.equal(second.repeated, true); assert.equal(h.calls.copies.length, 1); assert.equal(h.data().scanStatus, 'processing');
  assert.equal(h.calls.copies[0].opts.preconditionOpts.ifGenerationMatch, 0);
  assert.equal(h.calls.copies[0].opts.contentType, 'application/pdf');
  assert.equal(h.calls.copies[0].opts.metadata.companyId, 'acme');
  assert.equal(h.calls.copies[0].opts.metadata.metadata, undefined);
});

test('reintento del mismo claim repone unscanned si la copia anterior no ocurrió', async () => {
  const h = harness({ companyId: 'acme', status: 'quarantined', scanStatus: 'processing', scanSourceIdentity: sourceIdentity, scanHash: sha256 });
  const result = await quarantineScannerHandler(sourceEvent(), h.dependencies);
  assert.equal(result.repeated, true);
  assert.equal(result.dispatched, true);
  assert.equal(h.calls.copies.length, 1);
});

test('las copias fijan la generación exacta de cada objeto fuente', async () => {
  const input = harness();
  await quarantineScannerHandler(sourceEvent(), input.dependencies);
  assert.equal(input.calls.fileHandles.find(call => call.key === `app-bucket/${path}`).options?.generation, '7');

  const clean = harness({ companyId: 'acme', status: 'quarantined', scanStatus: 'processing', scanSourceIdentity: sourceIdentity, scanHash: sha256 });
  await cleanScannerResultHandler(resultEvent(CLEAN_BUCKET), clean.dependencies);
  assert.equal(clean.calls.fileHandles.find(call => call.key === `${CLEAN_BUCKET}/${path}`).options?.generation, '11');
});

test('otra generación no reemplaza un procesamiento activo', async () => {
  const h = harness({ companyId: 'acme', scanStatus: 'processing', scanSourceIdentity: sourceIdentity });
  const result = await quarantineScannerHandler(sourceEvent({ generation: '8' }), h.dependencies);
  assert.equal(result.busy, true); assert.equal(h.calls.copies.length, 0); assert.equal(h.data().scanSourceIdentity, sourceIdentity);
});

test('metadatos de entrada alterados no se despachan', async () => {
  const h = harness(); const result = await quarantineScannerHandler(sourceEvent({ metadata: { companyId: 'other', documentId: 'doc' } }), h.dependencies);
  assert.equal(result.dispatched, false); assert.equal(h.calls.copies.length, 0); assert.equal(h.data().scanStatus, 'quarantined');
});

test('EICAR nunca se envía ni se promociona y queda rejected', async () => {
  const infectedBytes = Buffer.from(`%PDF-${EICAR}`); const h = harness(undefined, { buffers: { [`app-bucket/${path}`]: infectedBytes } });
  const result = await quarantineScannerHandler(sourceEvent({ size: String(infectedBytes.length) }), h.dependencies);
  assert.equal(result.infected, true); assert.equal(h.calls.copies.length, 0); assert.equal(h.data().scanStatus, 'rejected');
});

test('fallo de copia conserva el origen y marca scan_error', async () => {
  const h = harness(undefined, { copyFails: true }); await quarantineScannerHandler(sourceEvent(), h.dependencies);
  assert.equal(h.data().scanStatus, 'scan_error'); assert.equal(h.calls.deletes.length, 0);
});

test('clean promueve exactamente una vez y usa precondiciones', async () => {
  const h = harness({ companyId: 'acme', status: 'quarantined', scanStatus: 'processing', scanSourceIdentity: sourceIdentity, scanHash: sha256 });
  const first = await cleanScannerResultHandler(resultEvent(CLEAN_BUCKET), h.dependencies); const second = await cleanScannerResultHandler(resultEvent(CLEAN_BUCKET), h.dependencies);
  assert.equal(first.finalized, true); assert.equal(second.repeated, true); assert.equal(h.calls.copies.length, 1); assert.equal(h.data().scanStatus, 'clean');
  assert.equal(h.calls.copies[0].opts.preconditionOpts.ifGenerationMatch, 0);
  assert.ok(h.calls.deletes.every(call => call.opts.ifGenerationMatch));
});

test('resultado retrasado de una generación anterior se ignora', async () => {
  const currentIdentity = `app-bucket/${path}#8`; const h = harness({ companyId: 'acme', scanStatus: 'processing', scanSourceIdentity: currentIdentity, scanHash: sha256 });
  const result = await cleanScannerResultHandler(resultEvent(CLEAN_BUCKET), h.dependencies);
  assert.equal(result.reason, 'stale'); assert.equal(h.calls.copies.length, 0); assert.equal(h.data().scanStatus, 'processing');
});

test('aislamiento entre empresas impide promoción', async () => {
  const h = harness({ companyId: 'other', scanStatus: 'processing', scanSourceIdentity: sourceIdentity, scanHash: sha256 });
  const result = await cleanScannerResultHandler(resultEvent(CLEAN_BUCKET), h.dependencies);
  assert.equal(result.reason, 'foreign'); assert.equal(h.calls.copies.length, 0);
});

test('metadatos ausentes o alterados y hash distinto producen scan_error', async () => {
  const initial = { companyId: 'acme', scanStatus: 'processing', scanSourceObject: path, scanSourceIdentity: sourceIdentity, scanHash: sha256 };
  const missing = harness(initial); await cleanScannerResultHandler(resultEvent(CLEAN_BUCKET, { metadata: {} }), missing.dependencies); assert.equal(missing.data().scanStatus, 'scan_error');
  const altered = harness(initial); await cleanScannerResultHandler(resultEvent(CLEAN_BUCKET, { metadata: { ...resultEvent(CLEAN_BUCKET).data.metadata, companyId: 'other' } }), altered.dependencies); assert.equal(altered.calls.copies.length, 0);
  const wrongHash = harness(initial); await cleanScannerResultHandler(resultEvent(CLEAN_BUCKET, { metadata: { ...resultEvent(CLEAN_BUCKET).data.metadata, sha256: 'bad' } }), wrongHash.dependencies); assert.equal(wrongHash.data().scanStatus, 'scan_error');
});

test('infected finaliza rejected y nunca promociona', async () => {
  const h = harness({ companyId: 'acme', scanStatus: 'processing', scanSourceIdentity: sourceIdentity, scanHash: sha256 });
  const result = await infectedScannerResultHandler(resultEvent(INFECTED_BUCKET), h.dependencies);
  assert.equal(result.infected, true); assert.equal(h.data().scanStatus, 'rejected'); assert.equal(h.calls.copies.length, 0); assert.equal(h.data().scannerQuarantinePath, path);
});

test('infected no confirma éxito si el estado cambia después del claim', async () => {
  const initial = { companyId: 'acme', scanStatus: 'processing', scanSourceIdentity: sourceIdentity, scanHash: sha256 };
  const h = harness(initial, {
    afterTransaction: async ({ count, setData, data }) => {
      if (count === 1) setData({ ...data(), scanStatus: 'scan_error' });
    },
  });
  const result = await infectedScannerResultHandler(resultEvent(INFECTED_BUCKET), h.dependencies);
  assert.equal(result.finalized, false);
  assert.equal(result.reason, 'invalid_transition');
  assert.equal(h.data().scanStatus, 'scan_error');
  assert.equal(h.data().scannerQuarantinePath, undefined);
});

test('un claim infected impide que clean copie el mismo resultado concurrente', async () => {
  const h = harness({
    companyId: 'acme', scanStatus: 'processing', scanSourceIdentity: sourceIdentity, scanHash: sha256,
    scanResultOutcome: 'rejected', scanResultBucket: INFECTED_BUCKET, scanResultObject: path, scanResultGeneration: '11',
  });
  const result = await cleanScannerResultHandler(resultEvent(CLEAN_BUCKET), h.dependencies);
  assert.equal(result.reason, 'conflict');
  assert.equal(h.calls.copies.length, 0);
  assert.equal(h.data().scanStatus, 'processing');
});

test('carrera intercalada clean contra infected concede un solo claim', async () => {
  const h = harness({ companyId: 'acme', scanStatus: 'processing', scanSourceIdentity: sourceIdentity, scanHash: sha256 });
  const [infected, clean] = await Promise.all([
    infectedScannerResultHandler(resultEvent(INFECTED_BUCKET), h.dependencies),
    cleanScannerResultHandler(resultEvent(CLEAN_BUCKET), h.dependencies),
  ]);
  assert.equal(infected.finalized, true);
  assert.equal(clean.finalized, false);
  assert.equal(clean.reason, 'conflict');
  assert.equal(h.data().scanStatus, 'rejected');
  assert.equal(h.calls.copies.length, 0);
});

test('fallo de borrado posterior conserva clean y registra reintento', async () => {
  const h = harness({ companyId: 'acme', scanStatus: 'processing', scanSourceIdentity: sourceIdentity, scanHash: sha256 }, { deleteFails: [`app-bucket/${path}`] });
  const result = await cleanScannerResultHandler(resultEvent(CLEAN_BUCKET), h.dependencies);
  assert.equal(result.cleanupPending, true); assert.equal(h.data().scanStatus, 'clean'); assert.equal(h.data().quarantineCleanupPending, true);
});

test('transición inválida se rechaza y estados terminales no vuelven a processing', async () => {
  const invalid = harness({ companyId: 'acme', scanStatus: 'scan_error' }); const result = await quarantineScannerHandler(sourceEvent(), invalid.dependencies); assert.equal(result.invalidTransition, true);
  for (const scanStatus of ['clean', 'rejected']) {
    const terminal = harness({ companyId: 'acme', scanStatus }); await quarantineScannerHandler(sourceEvent(), terminal.dependencies); assert.equal(terminal.data().scanStatus, scanStatus); assert.equal(terminal.calls.copies.length, 0);
  }
});
