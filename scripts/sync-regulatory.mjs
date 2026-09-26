import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root,'functions/package.json'));
const {initializeApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
const {getStorage} = require('firebase-admin/storage');
const {publishPage,historyIdentity,validatePage} = require('./services/regulatoryPublisher.js');
const args=process.argv.slice(2),flags=new Map();
try {
  for(let i=0;i<args.length;i+=2){
    const key=args[i],value=args[i+1];
    if(!['--next-root','--db','--company','--stream','--project','--bucket','--max-pages','--page-size'].includes(key)||flags.has(key)||!value||value.startsWith('--'))throw new Error('Invalid arguments');
    flags.set(key,value);
  }
  for(const key of ['--next-root','--db','--company','--stream','--project','--bucket'])if(!flags.has(key))throw new Error(`Required: ${key}`);
  const projectId=flags.get('--project');
  if(projectId.startsWith('demo-') && (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST))throw new Error('Demo project requires Firestore and Storage emulators');
  if(!projectId.startsWith('demo-') && (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_STORAGE_EMULATOR_HOST))throw new Error('Use a demo- project with emulators');
  const companyId=flags.get('--company'),streamId=flags.get('--stream');
  if(!/^[a-zA-Z0-9_-]{1,128}$/.test(companyId)||!/^[a-zA-Z0-9_-]{1,128}$/.test(streamId))throw new Error('Invalid company/stream');
  const maxPages=Number(flags.get('--max-pages')??10);
  if(!Number.isSafeInteger(maxPages)||maxPages<1||maxPages>100)throw new Error('max-pages must be 1..100');
  const pageSize=Number(flags.get('--page-size')??25);
  if(!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>100)throw new Error('page-size must be 1..100');
  const nextRoot=resolve(flags.get('--next-root')),databasePath=resolve(flags.get('--db'));
  const exportPage=async(after,limit)=>{
    const {stdout}=await promisify(execFile)(process.execPath,['--import','tsx','scripts/export-master.ts','--db',databasePath,'--after',String(after),'--limit',String(limit)],
      {cwd:nextRoot,env:{...process.env,TSX_DISABLE_CACHE:'1'},maxBuffer:45*1024*1024,timeout:120000});
    return JSON.parse(stdout);
  };
  const firstPage=await exportPage(0,1);
  validatePage(firstPage);
  if(!firstPage.records.length){console.log(JSON.stringify({status:'empty',message:'No publications to synchronize'}));process.exit(0);}
  const databaseId=historyIdentity(firstPage);
  const app=initializeApp({projectId,storageBucket:flags.get('--bucket')});
  const db=getFirestore(app),bucket=getStorage(app).bucket();
  const state=db.doc(`companies/${companyId}/regulatorySync/${streamId}`);
  for(let pageNumber=1;pageNumber<=maxPages;pageNumber++){
    const saved=await state.get();
    if(saved.exists&&saved.data().databaseId&&saved.data().databaseId!==databaseId)throw new Error('Database differs from registered stream');
    const after=saved.exists?saved.data().cursor:0;
    const page=await exportPage(after,pageSize);
    const result=await publishPage({db,bucket,companyId,streamId,page,databaseId});
    if(!page.records.length){console.log(JSON.stringify({status:'complete',cursor:after}));break;}
    console.log(JSON.stringify({page:pageNumber,...result}));
    if(pageNumber===maxPages){console.log(JSON.stringify({status:'bounded',message:'Run again to continue from saved cursor'}));process.exitCode=2;}
  }
} catch(error){console.error(JSON.stringify({error:error.message}));process.exitCode=1;}
