import { collection, query, orderBy, limit, startAfter, getDocsFromServer } from 'firebase/firestore';
import { ref, getBytes } from 'firebase/storage';
import { db, storage } from '@/firebase';
export async function listRegulatoryNotices(companyId, cursor = null) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(companyId)) throw new Error('Empresa inválida');
  const constraints = [orderBy('notice.observedAt', 'desc'), limit(25)];
  if (cursor) constraints.push(startAfter(cursor));
  const snapshot = await getDocsFromServer(query(collection(db, 'companies', companyId, 'regulatoryNotices'), ...constraints));
  return { records: snapshot.docs.map(item => ({id:item.id,...item.data()})), cursor:snapshot.docs.at(-1) ?? null, hasMore:snapshot.size===25 };
}
export async function downloadRegulatoryCapture(companyId, record) {
  const hash = record.capture.artifactId;
  if (!/^[a-f0-9]{64}$/.test(hash) || record.companyId!==companyId || record.capturePath!==`companies/${companyId}/regulatoryCaptures/${hash}`) throw new Error('Referencia de captura inválida');
  const bytes = await getBytes(ref(storage, record.capturePath), 25*1024*1024);
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');
  if(digest!==hash)throw new Error('La captura no coincide con su huella de integridad');
  return new Blob([bytes],{type:'application/octet-stream'});
}
