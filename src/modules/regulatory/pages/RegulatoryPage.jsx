import { useEffect, useRef, useState } from 'react';
import { useCompany } from '@/lib/companyContext';
import { useAuth } from '@/app/providers/AuthProvider';
import { listRegulatoryNotices, downloadRegulatoryCapture } from '@/infrastructure/firebase/regulatory';
import { Button } from '@/components/ui/button';

function OfficialLink({url, children}) {
  let valid = false;
  try { const parsed=new URL(url); valid=parsed.protocol==='https:'&&!parsed.username&&!parsed.password; } catch { /* invalid link remains plain text */ }
  return valid ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary underline">{children}</a> : <span>{children}</span>;
}
function CompanyNotices({companyId}) {
  const alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const [page,setPage]=useState({records:[],cursor:null,hasMore:false});
  const [after,setAfter]=useState(null);
  const [revision,setRevision]=useState(0);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [selected,setSelected]=useState(null);
  const [downloadError,setDownloadError]=useState('');
  const [downloading,setDownloading]=useState(false);
  useEffect(()=>{
    let active=true;
    setLoading(true);setError('');setSelected(null);setDownloadError('');setPage({records:[],cursor:null,hasMore:false});
    listRegulatoryNotices(companyId,after).then(result=>{if(active)setPage(result);})
      .catch(()=>{if(active)setError('No se pudieron consultar los avisos. Comprueba tu acceso a esta empresa e inténtalo de nuevo.');})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[companyId,after,revision]);
  async function download(record) {
    setDownloading(true);setDownloadError('');
    try {
      const blob=await downloadRegulatoryCapture(companyId,record);
      if(!alive.current)return;
      const url=URL.createObjectURL(blob),anchor=document.createElement('a');
      anchor.href=url;anchor.download=`captura-${record.capture.artifactId}.txt`;anchor.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch{setDownloadError('No se pudo descargar y verificar la captura. Comprueba tu acceso e inténtalo de nuevo.');}
    finally{setDownloading(false);}
  }
  return <div className="space-y-5">
    <div className="flex justify-between gap-4"><div><h1 className="text-2xl font-semibold">Avisos oficiales</h1><p className="text-muted-foreground">Publicaciones detectadas por GEMAILLA Next, con fuente y evidencia.</p></div><Button onClick={()=>{setAfter(null);setRevision(value=>value+1);}}>Actualizar</Button></div>
    <p className="rounded-lg border p-3 text-sm">Estos avisos requieren revisión. No determinan por sí solos vigencia, obligaciones ni aplicabilidad a tu empresa. Actualizar esta vista consulta lo sincronizado; no descarga nuevas fuentes.</p>
    {loading&&<p role="status">Consultando avisos…</p>}
    {error&&<p role="alert" className="text-red-700">{error}</p>}
    {!loading&&!error&&page.records.length===0&&<p>No hay avisos sincronizados en esta página. Esto no significa que no existan cambios regulatorios.</p>}
    <div className="space-y-3">{page.records.map(record=><article key={record.id} className="rounded-xl border bg-card p-4 space-y-2">
      <p className="text-sm text-muted-foreground">{record.notice.sourceId} · {record.notice.kind==='representation-changed'?'Cambio de representación detectado':'Primera observación de esta versión'}</p>
      <h2 className="font-semibold">{record.notice.title}</h2>
      <p className="text-sm">Observado: {new Date(record.notice.observedAt).toLocaleString('es-MX')}</p>
      <div className="flex gap-4 items-center"><OfficialLink url={record.notice.url}>Publicación oficial</OfficialLink><Button variant="outline" onClick={()=>{setSelected(record);setDownloadError('');}}>Ver evidencia</Button></div>
    </article>)}</div>
    {!loading&&!error&&<div className="flex gap-3"><Button variant="outline" disabled={!after} onClick={()=>setAfter(null)}>Volver al inicio</Button><Button disabled={!page.hasMore} onClick={()=>setAfter(page.cursor)}>Siguiente página</Button></div>}
    {selected&&<section aria-label="Evidencia del aviso" className="rounded-xl border bg-card p-5 space-y-3">
      <div className="flex justify-between"><h2 className="font-semibold">Evidencia del aviso</h2><Button variant="ghost" onClick={()=>setSelected(null)}>Cerrar evidencia</Button></div>
      <p>{selected.notice.title}</p>
      <p>Representación conservada: {selected.version.representationKind}. La captura puede ser un índice o sumario, no el texto íntegro del documento.</p>
      <p>Emisor: {selected.version.content.issuer || 'No identificado en esta representación'}</p>
      <p>Publicación: {selected.version.content.publishedAt || 'Fecha no indicada en la fuente capturada'}</p>
      <p><OfficialLink url={selected.capture.sourceUrl}>Fuente capturada</OfficialLink></p>
      <dl className="text-sm break-all space-y-2"><dt>Identificador de evidencia</dt><dd>{selected.notice.evidenceId}</dd><dt>SHA-256 de la captura</dt><dd>{selected.capture.artifactId}</dd><dt>Observación</dt><dd>{selected.capture.observationId}</dd></dl>
      <Button disabled={downloading} onClick={()=>download(selected)}>{downloading?'Verificando captura…':'Descargar captura verificada'}</Button>
      {downloadError&&<p role="alert">{downloadError}</p>}
    </section>}
  </div>;
}
export default function RegulatoryPage(){
  const {activeCompany}=useCompany();const {user}=useAuth();
  if(!user||!activeCompany)return <p>Selecciona una empresa para consultar sus avisos oficiales.</p>;
  return <CompanyNotices key={`${user.uid||user.id}:${activeCompany.id}`} companyId={activeCompany.id}/>;
}
