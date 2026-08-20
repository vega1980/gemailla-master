// @ts-check

import firebase from '@/api/firebaseClient';
import { logAction } from '@/lib/auditLogger';
import { DOCUMENT_STATUSES } from '@/features/documents/constants/documentStatuses';
import { ensureCorrelationId, getReleaseMetadata, logFrontendEvent } from '@/lib/observability';
import { validateDocumentFileContent, validateDocumentFileMetadata } from '@/security/documentFileValidation';

export function getUploadErrorMessage(error, fallback = 'No se pudo completar la subida a Storage.') {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function validateDocumentFile(file) {
  return validateDocumentFileMetadata(file);
}


export async function uploadDocumentFlow({ file, company, user, correlationId: providedCorrelationId }) {
  if (!company?.id) throw new Error('Necesitas una empresa activa para subir documentos.');

  const correlationId = ensureCorrelationId(providedCorrelationId, 'doc_upload');
  const { fileType, contentType } = await validateDocumentFileContent(file);
  const documentId = firebase.entities.Document.newId();

  const doc = await firebase.entities.Document.createWithId(documentId, {
    companyId: company.id,
    title: file.name,
    contentType,
    fileSize: file.size,
    fileType,
    status: DOCUMENT_STATUSES.UPLOADING,
    correlationId,
    release: getReleaseMetadata(),
  });

  try {
    await firebase.entities.Document.update(documentId, {
      status: DOCUMENT_STATUSES.QUARANTINED,
      correlationId,
      errorMessage: null,
    });

    const uploaded = await firebase.integrations.Core.UploadFile({
      file,
      companyId: company.id,
      documentId,
      correlationId,
    });

    await logAction({
      companyId: company.id,
      userEmail: user?.email,
      userName: user?.fullName,
      action: 'document_upload',
      entityType: 'Document',
      entityId: doc.id,
      details: file.name,
      correlationId,
    });

    return {
      ...doc,
      ...uploaded,
      id: documentId,
      status: DOCUMENT_STATUSES.QUARANTINED,
      correlationId,
    };
  } catch (uploadError) {
    await firebase.entities.Document.update(documentId, {
      status: DOCUMENT_STATUSES.ERROR,
      errorMessage: `${getUploadErrorMessage(uploadError)} (correlationId: ${correlationId})`,
      correlationId,
    }).catch(() => {});

    logFrontendEvent('document_upload_failed', { correlationId, documentId, companyId: company.id, message: getUploadErrorMessage(uploadError) }, 'error');
    throw uploadError;
  }
}
