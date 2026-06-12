import { beforeEach, describe, it } from 'node:test';
import {
  assertAllowed,
  assertDenied,
  clearFirestore,
  seedCompany,
  storageDelete,
  storageRead,
  storageUpdate,
  firestoreSet,
  storageUpload,
} from './rules-test-utils.mjs';

const companyId = 'company-storage';
const otherCompanyId = 'company-storage-other';
const owner = { uid: 'storage-owner-uid', claims: { email: 'storage-owner@gemailla.test', email_verified: true, companyId, companyRole: 'owner', membershipStatus: 'active' } };
const director = { uid: 'storage-director-uid', claims: { email: 'storage-director@gemailla.test', email_verified: true, companyId, companyRole: 'director', membershipStatus: 'active' } };
const outsider = { uid: 'storage-outsider-uid', claims: { email: 'storage-outsider@gemailla.test', email_verified: true, companyId: 'company-outsider', companyRole: 'viewer', membershipStatus: 'active' } };
const otherOwner = { uid: 'other-storage-owner-uid', claims: { email: 'other-storage-owner@gemailla.test', email_verified: true, companyId: otherCompanyId, companyRole: 'owner', membershipStatus: 'active' } };

const documentId = 'doc-1';
const missingDocumentId = 'doc-missing';
const validPdfPath = `companies/${companyId}/documents/${documentId}/file.pdf`;
const validXmlPath = `companies/${companyId}/documents/${documentId}/file.xml`;
const missingDocumentPdfPath = `companies/${companyId}/documents/${missingDocumentId}/file.pdf`;
const otherCompanyPdfPath = `companies/${otherCompanyId}/documents/doc-1-other-company/file.pdf`;

async function seedStorageAcl() {
  await seedCompany({
    companyId,
    ownerUid: owner.uid,
    memberships: [
      { userUid: director.uid, userEmail: director.claims.email, role: 'director', status: 'active' },
    ],
  });
  await seedCompany({ companyId: otherCompanyId, ownerUid: 'other-storage-owner-uid' });

  await assertAllowed(firestoreSet(`documents/${documentId}`, {
    companyId,
    ownerUid: owner.uid,
    title: 'Documento listo para Storage',
    contentType: 'application/pdf',
    fileSize: 100,
    fileType: 'pdf',
    status: 'uploading',
  }), 'admin storage document seed');

  await assertAllowed(firestoreSet('documents/doc-1-other-company', {
    companyId: otherCompanyId,
    ownerUid: otherOwner.uid,
    title: 'Documento de otra empresa',
    contentType: 'application/pdf',
    fileSize: 100,
    fileType: 'pdf',
    status: 'uploading',
  }), 'admin other company storage document seed');
}

describe('Cloud Storage security rules', () => {
  beforeEach(async () => {
    await clearFirestore();
    await seedStorageAcl();
  });

  it('allows PDF and XML uploads only with matching tenant claims and custom metadata', async () => {
    await assertAllowed(storageUpload(validPdfPath, owner, {
      contentType: 'application/pdf',
      body: '%PDF-1.7 fixture',
      metadata: { companyId, documentId },
    }), 'owner upload PDF with matching tenant metadata');
    await assertAllowed(storageUpload(validXmlPath, director, {
      contentType: 'application/xml',
      body: '<invoice id="fixture" />',
      metadata: { companyId, documentId },
    }), 'director upload XML with matching tenant metadata');

    await assertDenied(
      storageUpload(`companies/${companyId}/documents/file.pdf`, owner),
      'upload missing documentId path segment',
    );
    await assertDenied(
      storageUpload(`companies/${companyId}/private/doc-1/file.pdf`, owner),
      'upload outside documents nest',
    );
    await assertDenied(
      storageUpload(`documents/${companyId}/doc-1/file.pdf`, owner),
      'upload outside companies root',
    );
    await assertDenied(
      storageUpload(missingDocumentPdfPath, owner),
      'upload without required Storage custom metadata',
    );
  });

  it('rejects invalid MIME types and files larger than 15 MB', async () => {
    await assertDenied(storageUpload(`companies/${companyId}/documents/${documentId}/file.exe`, owner, {
      contentType: 'application/octet-stream',
      body: 'not a PDF or XML',
    }), 'invalid MIME upload');

    await assertDenied(storageUpload(`companies/${companyId}/documents/${documentId}/oversized.pdf`, owner, {
      contentType: 'application/pdf',
      body: Buffer.alloc((15 * 1024 * 1024) + 1, 0x61),
    }), 'oversized PDF upload');
  });

  it('rejects uploads when required custom metadata is missing or belongs to another company', async () => {
    await assertDenied(
      storageUpload(missingDocumentPdfPath, owner),
      'upload without required Storage custom metadata',
    );

    await assertDenied(
      storageUpload(`companies/${companyId}/documents/doc-1-other-company/file.pdf`, owner, {
        metadata: { companyId: otherCompanyId, documentId: 'doc-1-other-company' },
      }),
      'upload path company differs from Storage custom metadata',
    );
  });

  it('allows reads only with valid company permissions', async () => {
    await assertAllowed(storageUpload(validPdfPath, owner, { metadata: { companyId, documentId } }), 'owner fixture upload');

    await assertAllowed(storageRead(validPdfPath, owner), 'owner read');
    await assertAllowed(storageRead(validPdfPath, director), 'active director read');
    await assertDenied(storageRead(validPdfPath, outsider), 'outsider read');
  });

  it('blocks client updates and physical deletes even for permitted company users', async () => {
    await assertAllowed(storageUpload(validPdfPath, owner, { metadata: { companyId, documentId } }), 'owner fixture upload before update/delete');

    await assertDenied(storageUpdate(validPdfPath, owner), 'owner physical update');
    await assertDenied(storageUpdate(validPdfPath, director), 'director physical update');
    await assertDenied(storageDelete(validPdfPath, owner), 'owner physical delete');
    await assertDenied(storageDelete(validPdfPath, director), 'director physical delete');
  });

  it('denies access to another company', async () => {
    await assertDenied(
      storageUpload(`companies/${otherCompanyId}/documents/doc-2/file.pdf`, owner, {
        metadata: { companyId: otherCompanyId, documentId: 'doc-2' },
      }),
      'owner upload to another company',
    );

    await assertAllowed(storageUpload(otherCompanyPdfPath, otherOwner, {
      metadata: { companyId: otherCompanyId, documentId: 'doc-1-other-company' },
    }), 'other company owner fixture upload');
    await assertDenied(storageRead(otherCompanyPdfPath, owner), 'owner read from another company');
  });
});
