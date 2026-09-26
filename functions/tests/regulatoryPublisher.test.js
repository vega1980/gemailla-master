const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validatePage}=require('../services/regulatoryPublisher');
const {fixture}=require('./fixtures/regulatoryPage');

test('accepts a traceable bounded page',()=>assert.equal(validatePage(fixture()).nextCursor,1));
for(const [name,alter] of [
 ['altered metadata',p=>p.records[0].version.content.title='Alterado'],
 ['altered capture',p=>p.captures[p.records[0].capture.artifactId].contentBase64='ZmFsc28='],
 ['wrong evidence',p=>p.records[0].notice.evidenceId='a'.repeat(64)],
 ['wrong cursor',p=>p.nextCursor=99],
 ['unsafe URL',p=>p.records[0].capture.sourceUrl='javascript:alert(1)'],
 ['duplicate publication',p=>p.records.push(structuredClone(p.records[0]))],
 ['unsupported schema',p=>p.schema='unknown'],
 ['unlinked observation',p=>p.records[0].capture.observationId='another'],
])test(`rejects ${name}`,()=>{const p=fixture();alter(p);assert.throws(()=>validatePage(p));});
