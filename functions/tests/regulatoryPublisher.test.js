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

const {createHash}=require('node:crypto');
const {publishPage,historyIdentity}=require('../services/regulatoryPublisher');
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function harness(initialState, transactionState=initialState) {
 let stored=initialState,uploads=0;
 const snapshot=value=>({exists:!!value,data:()=>value});
 const state={get:async()=>snapshot(stored)};
 const noticeRef={};
 const company={get:async()=>({exists:true}),collection:name=>({doc:()=>name==='regulatorySync'?state:noticeRef})};
 const db={doc:()=>company,runTransaction:async action=>action({
  get:async ref=>ref===state?snapshot(transactionState):ref===company?{exists:true}:{exists:false},
  create:()=>{},set:(_ref,value)=>{stored=value;},
 })};
 const bucket={file:()=>({save:async()=>{uploads++;}})};
 return {db,bucket,companyId:'company',streamId:'stream',state:()=>stored,uploads:()=>uploads};
}
function continuation(page) {
 return {...page,after:1,previousNoticeHash:digest(page.records[0].notice),records:[],captures:{}};
}
test('resumes relocated history without storing a host path',async()=>{
 const page=fixture(),databaseId=historyIdentity(page);
 const initial={schema:2,cursor:1,databaseId,lastNoticeHash:digest(page.records[0].notice)};
 const remote=harness(initial);
 await publishPage({...remote,page:continuation(page),databaseId});
 assert.equal(remote.state().databaseId,databaseId);
 assert.equal(remote.state().databasePath,undefined);
});
test('migrates a legacy path binding only with a matching cursor anchor',async()=>{
 const page=fixture(),databaseId=historyIdentity(page);
 const initial={schema:1,cursor:1,databasePath:'/old/machine.sqlite',lastNoticeHash:digest(page.records[0].notice)};
 const remote=harness(initial);
 await publishPage({...remote,page:continuation(page),databaseId});
 assert.equal(remote.state().schema,2);
 assert.equal(remote.state().databaseId,databaseId);
 const wrong=harness({...initial,lastNoticeHash:'a'.repeat(64)});
 await assert.rejects(publishPage({...wrong,page:continuation(page),databaseId}),/cursor anchor differs/);
 assert.equal(wrong.state().schema,1);
});
test('rejects another history and a concurrently changed anchor',async()=>{
 const page=fixture(),databaseId=historyIdentity(page);
 const initial={schema:2,cursor:1,databaseId,lastNoticeHash:digest(page.records[0].notice)};
 await assert.rejects(publishPage({...harness(initial),page:continuation(page),databaseId:'a'.repeat(64)}),/another database/);
 const raced=harness(initial,{...initial,lastNoticeHash:'a'.repeat(64)});
 await assert.rejects(publishPage({...raced,page:continuation(page),databaseId}),/cursor anchor differs/);
 assert.deepEqual(raced.state(),initial);
});
test('rejects an oversized aggregate before uploads or database access',async()=>{
 const page=fixture();
 const original=page.records[0];
 page.records=Array.from({length:12},(_,index)=>{
  const record=structuredClone(original);
  record.version.content.externalDocumentId=String(index);
  record.version.content.description='x'.repeat(380000);
  record.version.versionId=digest([record.version.representationKind,record.version.documentId,record.version.content]);
  record.notice.versionId=record.version.versionId;
  record.notice.evidenceId=digest([record.notice.sourceId,record.notice.versionId]);
  record.notice.sequence=index+1;
  return record;
 });
 page.nextCursor=12;
 validatePage(page);
 await assert.rejects(publishPage({companyId:'company',streamId:'stream',page,databaseId:historyIdentity(page),
  db:{doc:()=>assert.fail('must reject before database access')},bucket:{file:()=>assert.fail('must reject before upload')}
 }),/exceeds 4 MiB/);
});
test('publishes a bounded page and binds its portable identity',async()=>{
 const page=fixture(),remote=harness(),databaseId=historyIdentity(page);
 const result=await publishPage({...remote,page,databaseId});
 assert.equal(result.published,1);
 assert.equal(remote.uploads(),1);
 assert.equal(remote.state().databaseId,databaseId);
});
test('history identity requires a validated first publication',()=>{
 const page=fixture();
 assert.equal(historyIdentity(structuredClone(page)),historyIdentity(page));
 assert.throws(()=>historyIdentity(continuation(page)),/first publication/);
 assert.throws(()=>historyIdentity({...page,records:[],captures:{},nextCursor:0}),/empty history/);
});
