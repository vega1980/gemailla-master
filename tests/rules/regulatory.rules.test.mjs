import { test } from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import { createRequire } from 'node:module';
import { PROJECT_ID, STORAGE_BUCKET, seedCompany, firestoreGet, firestoreSet, storageRead, storageUpload, assertAllowed, assertDenied } from './rules-test-utils.mjs';
const require=createRequire(new URL('../../functions/package.json',import.meta.url));
const {initializeApp,deleteApp}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {getStorage}=require('firebase-admin/storage');
const {publishPage}=require('./services/regulatoryPublisher');
const {fixture}=require('./tests/fixtures/regulatoryPage');
test('published evidence is idempotent and readable only inside its company',async()=>{
 const companyId='regulatory-rule-company',streamId='next-test';
 await seedCompany({companyId,ownerUid:'reg-owner',memberships:[{userUid:'reg-reader',role:'viewer',status:'active'},{userUid:'reg-revoked',role:'viewer',status:'inactive'}]});
 const app=initializeApp({projectId:PROJECT_ID,storageBucket:STORAGE_BUCKET},'regulatory-rules');
 try{
  const db=getFirestore(app),bucket=getStorage(app).bucket(),page=fixture();
  const args={db,bucket,companyId,streamId,page,databasePath:'/test.sqlite'};
  const first=await publishPage(args);assert.equal(first.published,1);
  await assert.rejects(publishPage(args),/Cursor conflict/);
  const again=await publishPage({...args,page:{...page,after:1,previousNoticeHash:createHash('sha256').update(JSON.stringify(page.records[0].notice)).digest('hex'),nextCursor:1,records:[],captures:{}}});assert.equal(again.published,0);
  const id=page.records[0].notice.evidenceId,path=`companies/${companyId}/regulatoryNotices/${id}`;
  const capturePath=`companies/${companyId}/regulatoryCaptures/${page.records[0].capture.artifactId}`;
  await assertAllowed(firestoreGet(path,'reg-reader'),'member reads notice');
  await assertAllowed(storageRead(capturePath,'reg-reader'),'member downloads capture');
  for(const user of ['stranger','reg-revoked',null]){
   await assertDenied(firestoreGet(path,user),'outsider cannot read notice');
   await assertDenied(storageRead(capturePath,user),'outsider cannot read capture');
  }
  await assertDenied(firestoreSet(path,{fake:true},'reg-owner'),'even owner cannot forge notice');
  await assertDenied(firestoreSet(`companies/${companyId}/regulatorySync/${streamId}`,{cursor:99},'reg-owner'),'owner cannot move cursor');
  await assertDenied(storageUpload(capturePath,'reg-owner',{contentType:'text/plain',body:'forged'}),'cannot replace capture');
  await assertAllowed(firestoreSet(`companyMembers/${companyId}_reg-reader`,{companyId,userUid:'reg-reader',role:'viewer',status:'inactive'}),'revoke membership');
  await assertDenied(firestoreGet(path,'reg-reader'),'revoked reader denied immediately');
  await assertDenied(storageRead(capturePath,'reg-reader'),'revoked capture access denied');
 }finally{await deleteApp(app);}
});
