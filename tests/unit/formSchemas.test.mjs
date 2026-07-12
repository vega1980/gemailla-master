import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { z } from 'zod';

import { companySchema } from '../../src/shared/validation/companySchemas.js';
import {
  documentFormSchema,
  documentRecordSchema,
  documentUploadMetadataSchema,
} from '../../src/shared/validation/documentSchemas.js';
import { memberInviteSchema, memberRecordSchema } from '../../src/shared/validation/memberSchemas.js';

function parseError(schema, payload) {
  const result = schema.safeParse(payload);
  assert.equal(result.success, false);
  assert.ok(result.error instanceof z.ZodError);
  return result.error;
}

function assertIssueCode(error, code) {
  assert.ok(
    error.issues.some((issue) => issue.code === code),
    `Expected issue code ${code}; got ${error.issues.map((issue) => issue.code).join(', ')}`,
  );
}

describe('form validation schemas', () => {
  describe('formulario de empresa', () => {
    it('trimmea campos y convierte strings opcionales vacíos en undefined', () => {
      assert.deepEqual(companySchema.parse({
        name: '  Gemailla  ',
        rfc: '  ',
        industry: ' Tecnología ',
        address: '',
        phone: '  ',
        email: ' contacto@gemailla.test ',
        fiscalRegime: '',
      }), {
        name: 'Gemailla',
        rfc: undefined,
        industry: 'Tecnología',
        address: undefined,
        phone: undefined,
        email: 'contacto@gemailla.test',
        fiscalRegime: undefined,
      });
    });

    it('acepta el payload real del formulario de creación y rechaza email inválido/campos desconocidos', () => {
      const formPayload = {
        name: '  Gemailla Norte  ',
        rfc: '',
        industry: 'tecnología',
        address: ' Av. Reforma 123 ',
        phone: ' 5551234567 ',
        email: '',
        fiscalRegime: '',
      };

      assert.deepEqual(companySchema.parse(formPayload), {
        name: 'Gemailla Norte',
        rfc: undefined,
        industry: 'tecnología',
        address: 'Av. Reforma 123',
        phone: '5551234567',
        email: undefined,
        fiscalRegime: undefined,
      });
      assertIssueCode(parseError(companySchema, { name: 'Gemailla', email: 'no-es-email' }), 'invalid_string');
      assertIssueCode(parseError(companySchema, { name: 'Gemailla', unexpected: true }), 'unrecognized_keys');
    });
  });

  describe('invitación de miembro', () => {
    it('solo acepta campos enviados por el formulario y aplica default de rol', () => {
      assert.deepEqual(memberInviteSchema.parse({
        userEmail: ' invitado@example.com ',
        userName: '  ',
      }), {
        userEmail: 'invitado@example.com',
        userName: undefined,
        role: 'invitado',
      });

      assert.deepEqual(memberInviteSchema.parse({
        userEmail: ' viewer@example.com ',
        role: 'viewer',
      }), {
        userEmail: 'viewer@example.com',
        role: 'viewer',
      });
    });

    it('rechaza campos internos, campos desconocidos y enums inválidos desde el formulario', () => {
      assertIssueCode(
        parseError(memberInviteSchema, { companyId: 'company-1', userEmail: 'user@example.com', role: 'viewer' }),
        'unrecognized_keys',
      );
      assertIssueCode(
        parseError(memberInviteSchema, { userEmail: 'user@example.com', role: 'owner' }),
        'invalid_enum_value',
      );
      assertIssueCode(
        parseError(memberInviteSchema, { userEmail: 'user@example.com', role: 'miembro' }),
        'invalid_enum_value',
      );

      assertIssueCode(
        parseError(memberInviteSchema, { userEmail: 'user@example.com', role: 'viewer', status: 'active' }),
        'unrecognized_keys',
      );
      assertIssueCode(
        parseError(memberInviteSchema, { userEmail: 'user@example.com', role: 'viewer', userUid: 'uid-1' }),
        'unrecognized_keys',
      );
    });

    it('mantiene separado el registro interno de miembro', () => {
      assert.deepEqual(memberRecordSchema.parse({
        companyId: ' company-1 ',
        userUid: ' uid-1 ',
        userEmail: ' member@example.com ',
        role: 'viewer',
        userName: '',
      }), {
        companyId: 'company-1',
        userUid: 'uid-1',
        userEmail: 'member@example.com',
        role: 'viewer',
        userName: undefined,
      });

      assertIssueCode(
        parseError(memberRecordSchema, {
          companyId: 'company-1',
          userUid: 'uid-1',
          userEmail: 'member@example.com',
          role: 'miembro',
        }),
        'invalid_enum_value',
      );
    });
  });

  describe('formulario de documento', () => {
    it('acepta solo campos de entrada de usuario y aplica default de tipo', () => {
      assert.deepEqual(documentFormSchema.parse({
        companyId: ' company-1 ',
        name: ' Factura julio ',
      }), {
        companyId: 'company-1',
        name: 'Factura julio',
        docType: 'otro',
      });
    });

    it('rechaza campos internos enviados desde formularios, campos desconocidos y enums inválidos', () => {
      for (const internalField of ['status', 'storagePath', 'ownerUid', 'correlationId', 'uploadCompletedAt', 'errorMessage', 'release']) {
        assertIssueCode(
          parseError(documentFormSchema, { companyId: 'company-1', name: 'Factura', [internalField]: 'internal' }),
          'unrecognized_keys',
        );
      }
      assertIssueCode(
        parseError(documentFormSchema, { companyId: 'company-1', name: 'Factura', docType: 'invoice' }),
        'invalid_enum_value',
      );
      assertIssueCode(
        parseError(documentFormSchema, { companyId: 'company-1', name: 'Factura', id: 'doc-1' }),
        'unrecognized_keys',
      );
    });
  });

  describe('metadata interna de subida de documento', () => {
    it('acepta el payload real construido por uploadDocumentFlow', () => {
      const uploadPayload = {
        companyId: ' company-1 ',
        title: ' factura.pdf ',
        contentType: 'application/pdf',
        fileSize: 1234,
        fileType: 'pdf',
        status: 'uploading',
        correlationId: ' doc_upload_123 ',
        release: { gitSha: 'abc123' },
      };

      assert.deepEqual(documentUploadMetadataSchema.parse(uploadPayload), {
        companyId: 'company-1',
        title: 'factura.pdf',
        contentType: 'application/pdf',
        fileSize: 1234,
        fileType: 'pdf',
        status: 'uploading',
        correlationId: 'doc_upload_123',
        release: { gitSha: 'abc123' },
      });
    });

    it('restringe estados, tipos de archivo y content-type a constantes oficiales', () => {
      const validPayload = {
        companyId: 'company-1',
        title: 'factura.pdf',
        contentType: 'application/pdf',
        fileSize: 1234,
        fileType: 'pdf',
        status: 'uploading',
      };

      assertIssueCode(parseError(documentUploadMetadataSchema, { ...validPayload, status: 'draft' }), 'invalid_enum_value');
      assertIssueCode(parseError(documentUploadMetadataSchema, { ...validPayload, fileType: 'docx' }), 'invalid_enum_value');
      assertIssueCode(parseError(documentUploadMetadataSchema, { ...validPayload, contentType: 'text/plain' }), 'invalid_enum_value');
    });

    it('valida límites de fileSize sin duplicar el límite de 15 MB', () => {
      const validPayload = {
        companyId: 'company-1',
        title: 'factura.pdf',
        contentType: 'application/pdf',
        fileType: 'pdf',
        status: 'uploading',
      };

      assertIssueCode(parseError(documentUploadMetadataSchema, { ...validPayload, fileSize: 0 }), 'too_small');
      assertIssueCode(parseError(documentUploadMetadataSchema, { ...validPayload, fileSize: -1 }), 'too_small');
      assertIssueCode(parseError(documentUploadMetadataSchema, { ...validPayload, fileSize: 15 * 1024 * 1024 + 1 }), 'too_big');
      assert.equal(documentUploadMetadataSchema.parse({ ...validPayload, fileSize: 15 * 1024 * 1024 }).fileSize, 15 * 1024 * 1024);
    });

    it('valida coherencia cruzada entre fileType y contentType', () => {
      const basePayload = {
        companyId: 'company-1',
        title: 'factura.pdf',
        fileSize: 1234,
        status: 'uploading',
      };

      assertIssueCode(parseError(documentUploadMetadataSchema, { ...basePayload, fileType: 'pdf', contentType: 'application/xml' }), 'custom');
      assertIssueCode(parseError(documentUploadMetadataSchema, { ...basePayload, fileType: 'xml', contentType: 'application/pdf' }), 'custom');
      assert.equal(documentUploadMetadataSchema.parse({ ...basePayload, fileType: 'xml', contentType: 'text/xml' }).contentType, 'text/xml');
    });

    it('mantiene el flujo de storagePath por estado', () => {
      const uploading = {
        companyId: 'company-1',
        title: 'factura.pdf',
        contentType: 'application/pdf',
        fileSize: 1234,
        fileType: 'pdf',
        status: 'uploading',
      };

      assert.equal(documentRecordSchema.parse(uploading).status, 'uploading');
      assertIssueCode(parseError(documentRecordSchema, { ...uploading, status: 'pending' }), 'custom');

      assert.deepEqual(documentRecordSchema.parse({
        ...uploading,
        status: 'pending',
        storagePath: ' companies/company-1/documents/doc-1/factura.pdf ',
        errorMessage: null,
      }), {
        companyId: 'company-1',
        title: 'factura.pdf',
        contentType: 'application/pdf',
        fileSize: 1234,
        fileType: 'pdf',
        status: 'pending',
        docType: 'otro',
        storagePath: 'companies/company-1/documents/doc-1/factura.pdf',
        errorMessage: null,
      });
    });

    it('rechaza URLs públicas y rutas internas de otra empresa como storagePath', () => {
      const pendingPayload = {
        companyId: 'company-1',
        title: 'factura.pdf',
        contentType: 'application/pdf',
        fileSize: 1234,
        fileType: 'pdf',
        status: 'pending',
      };

      assertIssueCode(parseError(documentRecordSchema, { ...pendingPayload, storagePath: 'https://firebasestorage.googleapis.com/v0/b/bucket/o/file.pdf' }), 'custom');
      assertIssueCode(parseError(documentRecordSchema, { ...pendingPayload, storagePath: 'gs://bucket/companies/company-1/documents/doc-1/file.pdf' }), 'custom');
      assertIssueCode(parseError(documentRecordSchema, { ...pendingPayload, storagePath: 'companies/other-company/documents/doc-1/file.pdf' }), 'custom');
      assertIssueCode(parseError(documentRecordSchema, { ...pendingPayload, storagePath: 'documents/doc-1/file.pdf' }), 'custom');
    });
  });
});
