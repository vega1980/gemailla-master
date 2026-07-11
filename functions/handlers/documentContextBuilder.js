const admin = require('firebase-admin');
const { XMLParser } = require('fast-xml-parser');
// unpdf: extracción PDF sin binarios nativos, apta para serverless. Evita el
// parser regex manual (ReDoS + object streams no soportados).

const MAX_DOCUMENT_BYTES = Number(process.env.AI_DOCUMENT_CONTEXT_MAX_BYTES || 1_000_000);
const MAX_DOCUMENT_CHARS = Number(process.env.AI_DOCUMENT_CONTEXT_MAX_CHARS || 24_000);
const MAX_TOTAL_CONTEXT_CHARS = Number(process.env.AI_DOCUMENT_CONTEXT_MAX_TOTAL_CHARS || 60_000);

const XML_DOCTYPE_PATTERN = /<!DOCTYPE\b/i;
const XML_ENTITY_PATTERN = /<!ENTITY\b/i;
// Solo peligroso dentro de una declaración DOCTYPE/DTD, no en el contenido de negocio.
const XML_DOCTYPE_EXTERNAL_PATTERN = /<!DOCTYPE[^>]*\b(SYSTEM|PUBLIC)\b/i;

function getDocumentLabel(document, index) {
  return String(document.title || document.name || document.fileName || document.originalName || document.id || `documento-${index + 1}`)
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, 180);
}

function getStoragePath(document) {
  return String(document.storagePath || document.path || document.filePath || '').trim();
}

function normalizeContentType(value) {
  return String(value || '').split(';')[0].trim().toLowerCase();
}

function detectFileType(buffer, contentType = '', fileName = '') {
  const type = normalizeContentType(contentType);
  const name = String(fileName || '').toLowerCase();
  const head = buffer.subarray(0, Math.min(buffer.length, 16)).toString('utf8');

  if (buffer.length >= 4 && buffer.subarray(0, 4).toString('utf8') === '%PDF') return 'pdf';
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) return 'zip';
  if (type.includes('xml') || name.endsWith('.xml') || head.trimStart().startsWith('<?xml') || head.trimStart().startsWith('<')) return 'xml';
  if (type.startsWith('text/') || type.includes('json') || type.includes('csv') || name.match(/\.(txt|csv|json|md|log)$/)) return 'text';
  return 'unknown';
}

function assertSupportedMagicNumber({ buffer, contentType, fileName, storagePath }) {
  const detectedType = detectFileType(buffer, contentType, fileName || storagePath);
  const declaredType = normalizeContentType(contentType);
  const declaredPdf = declaredType === 'application/pdf' || String(fileName || storagePath).toLowerCase().endsWith('.pdf');
  const declaredXml = declaredType.includes('xml') || String(fileName || storagePath).toLowerCase().endsWith('.xml');

  if (declaredPdf && detectedType !== 'pdf') {
    const error = new Error('Documento PDF rechazado: la firma de bytes no coincide con PDF.');
    error.status = 400;
    throw error;
  }
  if (declaredXml && detectedType !== 'xml') {
    const error = new Error('Documento XML rechazado: la firma/contenido inicial no coincide con XML.');
    error.status = 400;
    throw error;
  }
  if (detectedType === 'zip') {
    const error = new Error('Formato de documento comprimido no soportado para contexto IA.');
    error.status = 415;
    throw error;
  }
  return detectedType;
}

function normalizeXmlKey(key = '') {
  return String(key).replace(/^@_/, '').split(':').pop().toLowerCase();
}

function parseCfdiXmlSummary(xml) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
    processEntities: false,
    allowBooleanAttributes: false,
  });
  const parsed = parser.parse(xml);
  const lines = [];
  const wanted = new Set([
    'uuid', 'rfc', 'total', 'subtotal', 'fecha', 'folio', 'serie', 'moneda', 'metodopago',
    'formapago', 'tipodecomprobante', 'nombre', 'usocfdi',
  ]);

  function visit(node, path = []) {
    if (!node || typeof node !== 'object' || lines.length >= 180) return;
    if (Array.isArray(node)) {
      node.forEach((item) => visit(item, path));
      return;
    }

    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith('@_')) {
        const normalizedKey = normalizeXmlKey(key);
        if (wanted.has(normalizedKey) && value !== undefined && value !== null && String(value).trim()) {
          lines.push(`${path.join('.')}.${key.slice(2)}=${String(value).trim()}`);
        }
      } else if (value && typeof value === 'object') {
        visit(value, [...path, key.split(':').pop()]);
      }
    }
  }

  visit(parsed);
  return lines.join('\n');
}

function stripXmlTags(xml) {
  if (XML_DOCTYPE_PATTERN.test(xml) || XML_ENTITY_PATTERN.test(xml) || XML_DOCTYPE_EXTERNAL_PATTERN.test(xml)) {
    const error = new Error('XML rechazado: no se permiten DTD, ENTITY ni referencias externas.');
    error.status = 400;
    throw error;
  }
  return parseCfdiXmlSummary(xml);
}

function warnDocumentContext(eventName, payload = {}) {
  console.warn(JSON.stringify({
    severity: 'WARNING',
    eventName,
    timestamp: new Date().toISOString(),
    ...payload,
  }));
}

async function extractPdfText(buffer, metadata = {}) {
  const pdfSource = buffer.toString('latin1');
  if (/\/Encrypt\b/.test(pdfSource)) {
    const error = new Error('PDF cifrado no soportado para contexto IA.');
    error.status = 415;
    throw error;
  }

  const { extractText, getDocumentProxy } = await import('unpdf');
  let text = '';
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const result = await extractText(pdf, { mergePages: true });
    text = compactText(Array.isArray(result.text) ? result.text.join('\n') : result.text);
  } catch (error) {
    warnDocumentContext('pdf_text_extraction_failed', {
      documentId: metadata.documentId || null,
      storagePath: metadata.storagePath || null,
      reason: error.message,
    });
    return '';
  }

  if (!text) {
    warnDocumentContext('pdf_text_extraction_empty', {
      documentId: metadata.documentId || null,
      storagePath: metadata.storagePath || null,
      reason: 'El PDF puede ser escaneado, usar fuentes sin ToUnicode o requerir OCR.',
    });
  }
  return text;
}

function compactText(text) {
  return String(text || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function readDocumentBytes(document) {
  const storagePath = getStoragePath(document);
  if (!storagePath) return null;

  // DCB-3: el Admin SDK ignora las Storage rules. Validar prefijo de empresa
  // impide descargar ficheros de otra empresa vía storagePath manipulado.
  const companyId = String(document.companyId || '').trim();
  if (!companyId) {
    const error = new Error('Documento sin companyId: no se puede validar storagePath.');
    error.status = 403;
    throw error;
  }
  const expectedPrefix = `companies/${companyId}/documents/`;
  if (!storagePath.startsWith(expectedPrefix)) {
    const error = new Error('storagePath fuera del prefijo autorizado de la empresa.');
    error.status = 403;
    throw error;
  }

  const file = admin.storage().bucket().file(storagePath);
  const [metadata] = await file.getMetadata();
  const size = Number(metadata.size || 0);
  if (size > MAX_DOCUMENT_BYTES) {
    const error = new Error(`Documento demasiado grande para contexto IA (${size} bytes).`);
    error.status = 413;
    throw error;
  }
  const [buffer] = await file.download({ validation: 'crc32c' });
  if (buffer.length > MAX_DOCUMENT_BYTES) {
    const error = new Error(`Documento demasiado grande para contexto IA (${buffer.length} bytes).`);
    error.status = 413;
    throw error;
  }
  return { buffer, metadata, storagePath };
}

async function extractDocumentText(document) {
  const download = await readDocumentBytes(document);
  if (!download) return '';

  const fileName = document.fileName || document.originalName || download.metadata.name || download.storagePath;
  const contentType = document.contentType || download.metadata.contentType || '';
  const detectedType = assertSupportedMagicNumber({ buffer: download.buffer, contentType, fileName, storagePath: download.storagePath });
  let text = '';
  if (detectedType === 'xml') text = stripXmlTags(download.buffer.toString('utf8'));
  else if (detectedType === 'pdf') text = await extractPdfText(download.buffer, { documentId: document.id, storagePath: download.storagePath });
  else text = download.buffer.toString('utf8');
  return compactText(text).slice(0, MAX_DOCUMENT_CHARS);
}

async function buildDocumentContext(documents = []) {
  const sections = [];
  let totalLength = 0;
  for (const [index, document] of documents.entries()) {
    const text = await extractDocumentText(document);
    if (!text) continue;
    const label = getDocumentLabel(document, index);
    const section = `--- INICIO DOCUMENTO VALIDADO ${index + 1}: ${label} ---\n${text}\n--- FIN DOCUMENTO VALIDADO ${index + 1}: ${label} ---`;
    const remaining = MAX_TOTAL_CONTEXT_CHARS - totalLength;
    if (remaining <= 0) break;
    sections.push(section.slice(0, remaining));
    totalLength += Math.min(section.length, remaining);
  }
  return sections.join('\n\n');
}

module.exports = {
  buildDocumentContext,
  detectFileType,
  assertSupportedMagicNumber,
  stripXmlTags,
  parseCfdiXmlSummary,
  extractPdfText,
};
