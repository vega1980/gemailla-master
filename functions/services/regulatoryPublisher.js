const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const hash = value => createHash('sha256').update(value).digest('hex');
const segment = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function publicUrl(value) {
  const url = new URL(value);
  assert.ok(url.protocol === 'https:' && !url.username && !url.password, 'Invalid public URL');
}
function validatePage(page) {
  assert.equal(page.schema, 'gemailla-publications-v1');
  assert.ok(Number.isSafeInteger(page.after) && page.after >= 0);
  assert.ok(page.after === 0 ? page.previousNoticeHash === null : sha(page.previousNoticeHash), 'Invalid cursor anchor');
  assert.ok(Array.isArray(page.records) && page.records.length <= 100);
  assert.ok(page.captures && typeof page.captures === 'object');
  let cursor = page.after;
  const ids = new Set();
  for (const record of page.records) {
    const {notice, version, capture} = record;
    assert.ok(Number.isSafeInteger(notice.sequence) && notice.sequence > cursor);
    cursor = notice.sequence;
    assert.ok(sha(notice.evidenceId) && sha(version.versionId) && sha(capture.artifactId));
    assert.ok(!ids.has(notice.evidenceId)); ids.add(notice.evidenceId);
    assert.ok(['publication-observed','representation-changed'].includes(notice.kind));
    assert.ok(typeof notice.title === 'string' && notice.title.length > 0);
    assert.ok(Number.isFinite(Date.parse(notice.observedAt)));
    assert.equal(notice.versionId, version.versionId);
    assert.equal(notice.documentId, version.documentId);
    assert.equal(notice.representationKind, version.representationKind);
    assert.equal(version.versionId, hash(JSON.stringify([version.representationKind, version.documentId, version.content])));
    assert.equal(notice.evidenceId, hash(JSON.stringify([notice.sourceId, notice.versionId])));
    assert.equal(notice.title, version.content.title); assert.equal(notice.url, version.content.url);
    assert.equal(notice.observationId, capture.observationId); assert.equal(notice.sourceId, capture.sourceId);
    assert.equal(notice.observedAt, capture.checkedAt);
    publicUrl(notice.url); publicUrl(capture.sourceUrl); publicUrl(capture.finalUrl);
    const body = page.captures[capture.artifactId];
    assert.ok(body && typeof body.contentBase64 === 'string');
    assert.equal(body.contentType, capture.contentType);
    const bytes = Buffer.from(body.contentBase64, 'base64');
    assert.ok(bytes.length > 0 && bytes.length <= 25 * 1024 * 1024);
    assert.equal(bytes.toString('base64'), body.contentBase64);
    assert.equal(hash(bytes), capture.artifactId);
    assert.ok(Buffer.byteLength(JSON.stringify(record)) < 500000);
  }
  assert.equal(page.nextCursor, cursor);
  return page;
}

/** Trusted operator only. Browser clients cannot write these collections or objects. */
async function publishPage({db, bucket, companyId, streamId, page, databaseId}) {
  assert.ok(segment(companyId) && segment(streamId), 'Invalid company or stream');
  validatePage(page);
  assert.ok(sha(databaseId), 'Invalid database history identity');
  if(page.after === 0 && page.records.length) assert.equal(databaseId, historyIdentity(page), 'First publication identity differs');
  const projected = page.records.map(record => ({...record, schema:'gemailla-publications-v1',
    companyId, streamId, capturePath:`companies/${companyId}/regulatoryCaptures/${record.capture.artifactId}`}));
  const nextState = {schema:2,cursor:page.nextCursor,databaseId,streamId,
    lastNoticeHash:page.records.length ? hash(JSON.stringify(page.records.at(-1).notice)) : page.previousNoticeHash};
  // Bound the complete serialized write set before any remote upload; reserve
  // headroom for Firestore encoding, document paths and index updates.
  assert.ok(Buffer.byteLength(JSON.stringify({projected,nextState})) <= 4 * 1024 * 1024,
    'Publication page exceeds 4 MiB; export a smaller page');
  const company = db.doc(`companies/${companyId}`);
  assert.ok((await company.get()).exists, 'Company does not exist');
  const state = company.collection('regulatorySync').doc(streamId);
  const current = await state.get();
  assert.ok(!current.exists || ((current.data().schema === 1 && !current.data().databaseId) || current.data().databaseId === databaseId), 'Stream is already bound to another database');
  assert.equal(current.exists ? current.data().cursor : 0, page.after, 'Cursor conflict; reload before publishing');
  assert.equal(current.exists ? current.data().lastNoticeHash : null, page.previousNoticeHash, 'Database cursor anchor differs; do not reuse a stream for another history');
  for (const artifactId of new Set(page.records.map(r => r.capture.artifactId))) {
    const bytes = Buffer.from(page.captures[artifactId].contentBase64, 'base64');
    const file = bucket.file(`companies/${companyId}/regulatoryCaptures/${artifactId}`);
    try {
      await file.save(bytes, {resumable:false,preconditionOpts:{ifGenerationMatch:0},
        metadata:{contentType:'application/octet-stream',contentDisposition:`attachment; filename="captura-${artifactId}.txt"`,metadata:{sha256:artifactId}}});
    } catch (error) {
      if (Number(error.code) !== 412) throw error;
      const [existing] = await file.download(); assert.equal(hash(existing), artifactId, 'Stored capture conflict');
    }
  }
  return db.runTransaction(async tx => {
    const latest = await tx.get(state);
    assert.equal(latest.exists ? latest.data().cursor : 0, page.after, 'Concurrent publisher; reload cursor');
    assert.ok(!latest.exists || ((latest.data().schema === 1 && !latest.data().databaseId) || latest.data().databaseId === databaseId), 'Database identity conflict');
    assert.equal(latest.exists ? latest.data().lastNoticeHash : null, page.previousNoticeHash, 'Database cursor anchor differs');
    assert.ok((await tx.get(company)).exists, 'Company was removed');
    const refs = projected.map(item => company.collection('regulatoryNotices').doc(item.notice.evidenceId));
    const existing = [];
    for (const ref of refs) existing.push(await tx.get(ref));
    projected.forEach((item,index) => {
      if (existing[index].exists) assert.deepEqual(existing[index].data(),item,'Notice identity conflict');
      else tx.create(refs[index],item);
    });
    tx.set(state,nextState);
    return {published:existing.filter(item=>!item.exists).length,cursor:page.nextCursor};
  });
}
function historyIdentity(firstPage) {
  validatePage(firstPage);
  assert.equal(firstPage.after, 0, 'History identity requires the first publication');
  assert.ok(firstPage.records.length > 0, 'Cannot identify an empty history');
  return hash(JSON.stringify(firstPage.records[0].notice));
}
module.exports={validatePage,publishPage,historyIdentity};
