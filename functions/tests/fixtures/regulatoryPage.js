const {createHash}=require('node:crypto');
const hash=s=>createHash('sha256').update(s).digest('hex');
function fixture(){
 const content={externalDocumentId:'1',title:'Acuerdo de prueba',issuer:'Emisor',publishedAt:'2026-09-19',url:'https://dof.gob.mx/nota_detalle.php?codigo=1&fecha=19/09/2026'};
 const version={representationKind:'dof-publication-metadata-v1',documentId:'dof:1',content};
 version.versionId=hash(JSON.stringify([version.representationKind,version.documentId,content]));
 const notice={sequence:1,sourceId:'dof-sumario',documentId:version.documentId,versionId:version.versionId,representationKind:version.representationKind,title:content.title,url:content.url,kind:'publication-observed',observedAt:'2026-09-19T12:00:00.000Z',observationId:'test-observation',evidenceId:hash(JSON.stringify(['dof-sumario',version.versionId]))};
 const body=Buffer.from('<rss>fixture</rss>');const artifactId=hash(body);
 const capture={artifactId,observationId:notice.observationId,sourceId:notice.sourceId,sourceUrl:'https://dof.gob.mx/website/sumario.xml',finalUrl:'https://dof.gob.mx/website/sumario.xml',httpStatus:200,checkedAt:notice.observedAt,contentType:'text/xml'};
 return {schema:'gemailla-publications-v1',after:0,previousNoticeHash:null,nextCursor:1,records:[{notice,version,capture}],captures:{[artifactId]:{contentBase64:body.toString('base64'),contentType:'text/xml'}}};
}
module.exports={fixture};
