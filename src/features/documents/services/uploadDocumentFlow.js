// @ts-check

import firebase from '@/api/firebaseClient';
import { logAction } from '@/lib/auditLogger';
import { DOCUMENT_STATUSES } from '@/features/documents/constants/documentStatuses';

export function getUploadErrorMessage(error, fallback = 'No se pudo completar la subida a Storage.') {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function validateDocumentFile(file) {
  if (!file) throw new Error('No se recibió ningún archivo.');

  const ext = String(file.name || '').split('.').pop()?.toLowerCase();
  const validTypes = ['pdf', 'xml'];
  if (!validTypes.includes(ext)) {
    throw new Error('Formato no soportado. Sube archivos PDF o XML.');
  }

  if (file.size > 15 * 1024 * 1024) {
    throw new Error('Archivo muy grande. El límite es 15MB.');
  }

  return {
    ext,
    fileType: ext === 'xml' ? 'xml' : 'pdf',
    contentType: file.type || (ext === 'xml' ? 'application/xml' : 'application/pdf'),
  };
}

export async function uploadDocumentFlow({ file, company, user }) {
  if (!company?.id) throw new Error('Necesitas una empresa activa para subir documentos.');

  const { fileType, contentType } = validateDocumentFile(file);
  const documentId = firebase.entities.Document.newId();

  const doc = await firebase.entities.Document.createWithId(documentId, {
    companyId: company.id,
    title: file.name,
    contentType,
    fileSize: file.size,
    fileType,
    status: DOCUMENT_STATUSES.UPLOADING,
  });

  try {
    const uploaded = await firebase.integrations.Core.UploadFile({
      file,
      companyId: company.id,
      documentId,
    });

    await firebase.entities.Document.update(documentId, {
      storagePath: uploaded.storagePath,
      contentType: uploaded.contentType,
      fileSize: uploaded.fileSize,
      status: DOCUMENT_STATUSES.PENDING,
      uploadCompletedAt: new Date().toISOString(),
      errorMessage: null,
    });

    await logAction({
      companyId: company.id,
      userEmail: user?.email,
      userName: user?.fullName,
      action: 'document_upload',
      entityType: 'Document',
      entityId: doc.id,
      details: file.name,
    });

    return {
      ...doc,
      ...uploaded,
      id: documentId,
      status: DOCUMENT_STATUSES.PENDING,
    };
  } catch (uploadError) {
    await firebase.entities.Document.update(documentId, {
      status: DOCUMENT_STATUSES.ERROR,
      errorMessage: getUploadErrorMessage(uploadError),
    }).catch(() => {});

    throw uploadError;
  }
}
