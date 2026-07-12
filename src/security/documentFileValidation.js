/** @type {readonly ['pdf', 'xml']} */
export const ALLOWED_DOCUMENT_FILE_TYPES = ['pdf', 'xml'];
/** @type {readonly ['application/pdf', 'text/xml', 'application/xml']} */
export const ALLOWED_DOCUMENT_CONTENT_TYPES = ['application/pdf', 'text/xml', 'application/xml'];

/** @type {ReadonlySet<string>} */
const ALLOWED_EXTENSIONS = new Set(ALLOWED_DOCUMENT_FILE_TYPES);
/** @type {ReadonlySet<string>} */
const ALLOWED_CONTENT_TYPES = new Set(ALLOWED_DOCUMENT_CONTENT_TYPES);
export const MAX_DOCUMENT_SIZE_BYTES = 15 * 1024 * 1024;
const PDF_MAGIC = '%PDF-';

/** @param {string} [fileName] */
export function getDocumentExtension(fileName = '') {
  return String(fileName || '').split('.').pop()?.toLowerCase() || '';
}

/** @param {string} [fileName] */
export function getExpectedDocumentType(fileName = '') {
  const ext = getDocumentExtension(fileName);
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error('Formato no soportado. Sube archivos PDF o XML.');
  }
  return ext;
}

/** @param {{ name?: string, size: number, type?: string }} file */
export function validateDocumentFileMetadata(file) {
  if (!file) throw new Error('No se recibió ningún archivo.');
  const ext = getExpectedDocumentType(file.name);

  if (!Number.isFinite(file.size) || file.size <= 0) {
    throw new Error('Archivo vacío o inválido.');
  }

  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    throw new Error('Archivo muy grande. El límite es 15MB.');
  }

  const declaredType = String(file.type || '').toLowerCase();
  if (declaredType && !ALLOWED_CONTENT_TYPES.has(declaredType)) {
    throw new Error('Content-Type no permitido. Solo se aceptan PDF o XML.');
  }

  return {
    ext,
    fileType: ext,
    contentType: ext === 'xml' ? 'application/xml' : 'application/pdf',
  };
}

/** @param {{ size: number, slice(start?: number, end?: number): Blob }} file @param {number} [length] */
async function readStart(file, length = 512) {
  const chunk = file.slice(0, Math.min(length, file.size));
  const buffer = await chunk.arrayBuffer();
  return new Uint8Array(buffer);
}

/** @param {Uint8Array} bytes */
function decodeAscii(bytes) {
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
}

/** @param {{ name?: string, size: number, type?: string, slice(start?: number, end?: number): Blob }} file */
export async function validateDocumentFileContent(file) {
  const metadata = validateDocumentFileMetadata(file);
  const start = await readStart(file);
  const textStart = decodeAscii(start).replace(/^\uFEFF/, '').trimStart();

  if (metadata.ext === 'pdf' && !decodeAscii(start.slice(0, 5)).startsWith(PDF_MAGIC)) {
    throw new Error('PDF inválido: la firma del archivo no coincide con %PDF-.');
  }

  if (metadata.ext === 'xml') {
    if (!textStart.startsWith('<?xml') && !textStart.startsWith('<')) {
      throw new Error('XML inválido: el archivo no inicia como documento XML.');
    }
    if (/<!DOCTYPE/i.test(textStart) || /<!ENTITY/i.test(textStart)) {
      throw new Error('XML inválido: DOCTYPE/ENTITY no están permitidos.');
    }
  }

  return metadata;
}
