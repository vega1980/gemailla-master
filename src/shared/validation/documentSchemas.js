// @ts-check

import { z } from 'zod';
import { DOCUMENT_STATUSES } from '../../features/documents/constants/documentStatuses.js';
import {
  ALLOWED_DOCUMENT_CONTENT_TYPES,
  ALLOWED_DOCUMENT_FILE_TYPES,
  MAX_DOCUMENT_SIZE_BYTES,
} from '../../security/documentFileValidation.js';
import { DOCUMENT_TYPE_OPTIONS } from '../constants/documentTypes.js';
import { optionalTrimmedString, requiredTrimmedString } from './commonSchemas.js';

const documentFileTypeSchema = z.enum(ALLOWED_DOCUMENT_FILE_TYPES);
const documentContentTypeSchema = z.enum(ALLOWED_DOCUMENT_CONTENT_TYPES);
const documentStatusSchema = z.nativeEnum(DOCUMENT_STATUSES);

/** @param {string} storagePath @param {string} [companyId] */
export function isInternalDocumentStoragePath(storagePath, companyId = '') {
  const value = String(storagePath || '').trim();
  if (!value) return false;
  if (/^(?:https?:|gs:)\/\//i.test(value)) return false;
  if (/firebasestorage\.googleapis\.com|storage\.googleapis\.com/i.test(value)) return false;

  const match = value.match(/^companies\/([^/]+)\/documents\/([^/]+)\/.+$/);
  if (!match) return false;
  return !companyId || match[1] === companyId;
}

const storagePathSchema = z.string().trim().superRefine((storagePath, context) => {
  if (!isInternalDocumentStoragePath(storagePath)) {
    context.addIssue({ code: z.ZodIssueCode.custom });
  }
});

/** @param {z.RefinementCtx} context */
function addFileTypeContentTypeIssue(context) {
  context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ['contentType'],
  });
}

/** @param {{ fileType?: string, contentType?: string }} value @param {z.RefinementCtx} context */
function validateFileTypeContentType(value, context) {
  if (value.fileType === 'pdf' && value.contentType !== 'application/pdf') {
    addFileTypeContentTypeIssue(context);
  }
  if (value.fileType === 'xml' && !['application/xml', 'text/xml'].includes(String(value.contentType))) {
    addFileTypeContentTypeIssue(context);
  }
}

export const documentFormSchema = z.object({
  companyId: requiredTrimmedString('La empresa es obligatoria.'),
  name: requiredTrimmedString('El nombre del documento es obligatorio.'),
  docType: z.enum(DOCUMENT_TYPE_OPTIONS).default('otro'),
}).strict();

const documentUploadMetadataBaseSchema = z.object({
  companyId: requiredTrimmedString('La empresa es obligatoria.'),
  title: requiredTrimmedString('El nombre del documento es obligatorio.'),
  contentType: documentContentTypeSchema,
  fileSize: z.number().finite().positive().max(MAX_DOCUMENT_SIZE_BYTES),
  fileType: documentFileTypeSchema,
  status: documentStatusSchema,
  correlationId: optionalTrimmedString,
  release: z.record(z.unknown()).optional(),
}).strict();

export const documentUploadMetadataSchema = documentUploadMetadataBaseSchema.superRefine(validateFileTypeContentType);

export const documentRecordSchema = documentUploadMetadataBaseSchema.extend({
  docType: z.enum(DOCUMENT_TYPE_OPTIONS).default('otro'),
  storagePath: storagePathSchema.optional(),
  ownerUid: optionalTrimmedString,
  uploadCompletedAt: optionalTrimmedString,
  errorMessage: z.string().trim().nullable().optional(),
}).strict().superRefine((value, context) => {
  validateFileTypeContentType(value, context);

  if (value.storagePath && !isInternalDocumentStoragePath(value.storagePath, value.companyId)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['storagePath'],
    });
  }

  if (value.status === DOCUMENT_STATUSES.PENDING && !value.storagePath) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['storagePath'],
    });
  }
});

/**
 * @deprecated Usa documentFormSchema, documentUploadMetadataSchema o documentRecordSchema
 * según el contrato que necesitas validar.
 */
export const documentSchema = documentFormSchema;

/** @typedef {z.infer<typeof documentFormSchema>} DocumentFormInput */
/** @typedef {z.infer<typeof documentUploadMetadataSchema>} DocumentUploadMetadataInput */
/** @typedef {z.infer<typeof documentRecordSchema>} DocumentRecordInput */
