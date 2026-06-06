import { beforeEach, describe, it } from 'node:test';
import {
  assertAllowed,
  assertDenied,
  clearFirestore,
  seedCompany,
  storageDelete,
  storageRead,
  firestoreSet,
  storageUpload,
} from './rules-test-utils.mjs';

const companyId = 'company-storage';
const otherCompanyId = 'company-storage-other';
const owner = { uid: 'storage-owner-uid', claims: { email: 'storage-owner@gemailla.test', email_verified: true } };
const director = { uid: 'storage-director-uid', claims: { email: 'storage-director@gemailla.test', email_verified: true } };
const outsider = { uid: 'storage-outsider-uid', claims: { email: 'storage-outsider@gemailla.test', email_verified: true } };
const otherOwner = { uid: 'other-storage-owner-uid', claims: { email: 'other-storage-owner@gemailla.test', email_verified: true } };

const documentId = 'doc-1';
const missingDocumentId = 'doc-missing';
const validPdfPath = `companies/${companyId}/documents/${documentId}/file.pdf`;
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

  it('allows uploads only under companies/{companyId}/documents/{documentId}/{fileName}', async () => {
    await assertAllowed(storageUpload(validPdfPath, owner), 'owner upload to valid nested document path');

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
      'upload without Firestore document metadata',
    );
  });

  it('allows reads only with valid company permissions', async () => {
    await assertAllowed(storageUpload(validPdfPath, owner), 'owner fixture upload');

    await assertAllowed(storageRead(validPdfPath, owner), 'owner read');
    await assertAllowed(storageRead(validPdfPath, director), 'active director read');
    await assertDenied(storageRead(validPdfPath, outsider), 'outsider read');
  });

  it('blocks physical deletes even for permitted company users', async () => {
    await assertAllowed(storageUpload(validPdfPath, owner), 'owner fixture upload before delete');

    await assertDenied(storageDelete(validPdfPath, owner), 'owner physical delete');
    await assertDenied(storageDelete(validPdfPath, director), 'director physical delete');
  });

  it('denies access to another company', async () => {
    await assertDenied(
      storageUpload(`companies/${otherCompanyId}/documents/doc-2/file.pdf`, owner),
      'owner upload to another company',
    );

    await assertAllowed(storageUpload(otherCompanyPdfPath, otherOwner), 'other company owner fixture upload');
    await assertDenied(storageRead(otherCompanyPdfPath, owner), 'owner read from another company');
  });
});
