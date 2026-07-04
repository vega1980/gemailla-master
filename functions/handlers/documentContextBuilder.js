const admin = require('firebase-admin');
const zlib = require('node:zlib');

const MAX_DOCUMENT_BYTES = Number(process.env.AI_DOCUMENT_CONTEXT_MAX_BYTES || 1_000_000);
const MAX_DOCUMENT_CHARS = Number(process.env.AI_DOCUMENT_CONTEXT_MAX_CHARS || 24_000);
const MAX_TOTAL_CONTEXT_CHARS = Number(process.env.AI_DOCUMENT_CONTEXT_MAX_TOTAL_CHARS || 60_000);

const XML_DOCTYPE_PATTERN = /<!DOCTYPE\b/i;
const XML_ENTITY_PATTERN = /<!ENTITY\b/i;
const XML_EXTERNAL_REF_PATTERN = /\b(SYSTEM|PUBLIC)\b/i;

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

function stripXmlTags(xml) {
  if (XML_DOCTYPE_PATTERN.test(xml) || XML_ENTITY_PATTERN.test(xml) || XML_EXTERNAL_REF_PATTERN.test(xml)) {
    const error = new Error('XML rechazado: no se permiten DTD, ENTITY ni referencias externas.');
    error.status = 400;
    throw error;
  }
  return xml
    .replace(/<\?xml[\s\S]*?\?>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function warnDocumentContext(eventName, payload = {}) {
  console.warn(JSON.stringify({
    severity: 'WARNING',
    eventName,
    timestamp: new Date().toISOString(),
    ...payload,
  }));
}

function decodePdfEscapes(value) {
  return value
    .replace(/\\([nrtbf()\\])/g, (_match, escaped) => ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' }[escaped] || escaped))
    .replace(/\\([0-7]{1,3})/g, (_match, octal) => String.fromCharCode(parseInt(octal, 8)))
    .replace(/\\\r?\n/g, '');
}

function decodePdfHexString(hex) {
  const normalized = hex.replace(/\s+/g, '');
  const bytes = Buffer.from(normalized.length % 2 ? `${normalized}0` : normalized, 'hex');
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let text = '';
    for (let index = 2; index + 1 < bytes.length; index += 2) {
      text += String.fromCharCode((bytes[index] << 8) + bytes[index + 1]);
    }
    return text;
  }
  return bytes.toString('latin1');
}

function extractTextOperators(pdfSource) {
  const chunks = [];
  const literalStringPattern = /\((?:\\.|[^\\()])*\)\s*Tj/g;
  const arrayTextPattern = /\[((?:\s*\((?:\\.|[^\\()])*\)\s*-?\d*\.?\d*)+)\s*\]\s*TJ/g;
  const hexStringPattern = /<([0-9A-Fa-f\s]+)>\s*Tj/g;

  for (const match of pdfSource.matchAll(literalStringPattern)) {
    chunks.push(decodePdfEscapes(match[0].replace(/\s*Tj$/, '').slice(1, -1)));
  }
  for (const match of pdfSource.matchAll(arrayTextPattern)) {
    const literals = [...match[1].matchAll(/\((?:\\.|[^\\()])*\)/g)].map((item) => decodePdfEscapes(item[0].slice(1, -1)));
    if (literals.length) chunks.push(literals.join(''));
  }
  for (const match of pdfSource.matchAll(hexStringPattern)) {
    chunks.push(decodePdfHexString(match[1]));
  }
  return chunks.join('\n');
}

function inflatePdfStreams(pdfSource) {
  const chunks = [];
  const streamPattern = /(<<[\s\S]*?\/Filter\s*(?:\[[^\]]*)?\/FlateDecode[\s\S]*?>>)\s*stream\r?\n?([\s\S]*?)\r?\n?endstream/g;
  for (const match of pdfSource.matchAll(streamPattern)) {
    const streamBytes = Buffer.from(match[2], 'latin1');
    try {
      chunks.push(zlib.inflateSync(streamBytes).toString('latin1'));
    } catch (_error) {
      try {
        chunks.push(zlib.inflateRawSync(streamBytes).toString('latin1'));
      } catch (_rawError) {
        warnDocumentContext('pdf_stream_inflate_failed');
      }
    }
  }
  return chunks.join('\n');
}

function extractPdfText(buffer, metadata = {}) {
  const pdfSource = buffer.toString('latin1');
  if (/\/Encrypt\b/.test(pdfSource)) {
    const error = new Error('PDF cifrado no soportado para contexto IA.');
    error.status = 415;
    throw error;
  }

  const inflatedStreams = inflatePdfStreams(pdfSource);
  const text = compactText([
    extractTextOperators(inflatedStreams),
    extractTextOperators(pdfSource),
  ].filter(Boolean).join('\n'));

  if (!text) {
    warnDocumentContext('pdf_text_extraction_empty', {
      documentId: metadata.documentId || null,
      storagePath: metadata.storagePath || null,
      reason: 'El PDF puede ser escaneado, cifrado, usar fuentes sin ToUnicode o requerir OCR.',
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
  else if (detectedType === 'pdf') text = extractPdfText(download.buffer, { documentId: document.id, storagePath: download.storagePath });
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
  extractPdfText,
};
