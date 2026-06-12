import assert from 'node:assert/strict';
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
const owner = { uid: 'storage-owner-uid', claims: { email: 'storage-owner@gemailla.test', email_verified: true } };
const director = { uid: 'storage-director-uid', claims: { email: 'storage-director@gemailla.test', email_verified: true } };
const outsider = { uid: 'storage-outsider-uid', claims: { email: 'storage-outsider@gemailla.test', email_verified: true } };
const otherOwner = { uid: 'other-storage-owner-uid', claims: { email: 'other-storage-owner@gemailla.test', email_verified: true } };
const runId = `${Date.now()}-${process.pid}`;
const STORAGE_DOCUMENT_ROUTE = 'companies/{companyId}/documents/{documentId}/{fileName}';
const STORAGE_DOCUMENT_MATCH = /^companies\/[^/]+\/documents\/[^/]+\/[^/]+$/;

function documentStoragePath(pathCompanyId, pathDocumentId, fileName) {
  const path = `companies/${pathCompanyId}/documents/${pathDocumentId}/${fileName}`;
  assert.match(path, STORAGE_DOCUMENT_MATCH, `test fixture path must match storage.rules route ${STORAGE_DOCUMENT_ROUTE}`);
  return path;
}

async function seedUploadingDocument({ id, documentCompanyId, ownerAuth, title }) {
  await assertAllowed(firestoreSet(`documents/${id}`, {
    companyId: documentCompanyId,
    ownerUid: ownerAuth.uid,
    title,
    contentType: 'application/pdf',
    fileSize: 100,
    fileType: 'pdf',
    status: 'uploading',
  }, ownerAuth), `uploading document metadata create for ${id}`);
}

let testNumber = 0;
let documentId;
let missingDocumentId;
let otherCompanyDocumentId;
let validPdfPath;
let validXmlPath;
let missingDocumentPdfPath;
let otherCompanyPdfPath;

function resetStoragePaths() {
  testNumber += 1;
  documentId = `doc-${runId}-${testNumber}`;
  missingDocumentId = `doc-missing-${runId}-${testNumber}`;
  otherCompanyDocumentId = `doc-other-company-${runId}-${testNumber}`;
  validPdfPath = documentStoragePath(companyId, documentId, 'file.pdf');
  validXmlPath = documentStoragePath(companyId, documentId, 'file.xml');
  missingDocumentPdfPath = documentStoragePath(companyId, missingDocumentId, 'file.pdf');
  otherCompanyPdfPath = documentStoragePath(otherCompanyId, otherCompanyDocumentId, 'file.pdf');
}

async function seedStorageAcl() {
  await seedCompany({
    companyId,
    ownerUid: owner.uid,
    memberships: [
      { userUid: director.uid, userEmail: director.claims.email, role: 'director', status: 'active' },
    ],
  });
  await seedCompany({ companyId: otherCompanyId, ownerUid: 'other-storage-owner-uid' });

  await seedUploadingDocument({
    id: documentId,
    documentCompanyId: companyId,
    ownerAuth: owner,
    title: 'Documento listo para Storage',
  });

  await seedUploadingDocument({
    id: otherCompanyDocumentId,
    documentCompanyId: otherCompanyId,
    ownerAuth: otherOwner,
    title: 'Documento de otra empresa',
  });
}

describe('Cloud Storage security rules', () => {
  beforeEach(async () => {
    resetStoragePaths();
    await clearFirestore();
    await seedStorageAcl();
  });

  it('allows PDF and XML uploads only when a matching Firestore document exists', async () => {
    await assertAllowed(storageUpload(validPdfPath, owner, {
      contentType: 'application/pdf',
      body: '%PDF-1.7 fixture',
    }), 'owner upload PDF to existing document path');
    await assertAllowed(storageUpload(validXmlPath, director, {
      contentType: 'application/xml',
      body: '<invoice id="fixture" />',
    }), 'director upload XML to existing document path');
    await assertAllowed(storageUpload(documentStoragePath(companyId, documentId, 'file-text.xml'), director, {
      contentType: 'text/xml',
      body: '<invoice id="text-xml-fixture" />',
    }), 'director upload text/xml to existing document path');

    await assertDenied(
      storageUpload(`companies/${companyId}/documents/file.pdf`, owner),
      'upload missing documentId path segment',
    );
    await assertDenied(
      storageUpload(`companies/${companyId}/private/${documentId}/file.pdf`, owner),
      'upload outside documents nest',
    );
    await assertDenied(
      storageUpload(`documents/${companyId}/${documentId}/file.pdf`, owner),
      'upload outside companies root',
    );
    await assertDenied(
      storageUpload(missingDocumentPdfPath, owner),
      'upload without Firestore document metadata',
    );
  });

  it('rejects unauthenticated uploads, invalid MIME types and files larger than 15 MB', async () => {
    await assertDenied(storageUpload(validPdfPath, null), 'anonymous upload');

    await assertDenied(storageUpload(documentStoragePath(companyId, documentId, 'file.exe'), owner, {
      contentType: 'application/octet-stream',
      body: 'not a PDF or XML',
    }), 'invalid MIME upload');

    await assertDenied(storageUpload(documentStoragePath(companyId, documentId, 'renamed-pdf.txt'), owner, {
      contentType: 'text/plain',
      body: '%PDF bytes with an unsafe MIME',
    }), 'PDF-looking bytes with invalid MIME upload');

    await assertDenied(storageUpload(documentStoragePath(companyId, documentId, 'oversized.pdf'), owner, {
      contentType: 'application/pdf',
      body: Buffer.alloc((15 * 1024 * 1024) + 1, 0x61),
    }), 'oversized PDF upload');
  });

  it('rejects uploads when the Firestore document is missing or belongs to another company', async () => {
    await assertDenied(
      storageUpload(missingDocumentPdfPath, owner),
      'upload without Firestore document metadata',
    );

    await assertDenied(
      storageUpload(documentStoragePath(companyId, otherCompanyDocumentId, 'file.pdf'), owner),
      'upload path company differs from Firestore document company',
    );
  });

  it('allows reads only with valid company permissions', async () => {
    await assertAllowed(storageUpload(validPdfPath, owner), 'owner fixture upload');

    await assertAllowed(storageRead(validPdfPath, owner), 'owner read');
    await assertAllowed(storageRead(validPdfPath, director), 'active director read');
    await assertDenied(storageRead(validPdfPath, outsider), 'outsider read');
  });

  it('blocks client updates and physical deletes even for permitted company users', async () => {
    await assertAllowed(storageUpload(validPdfPath, owner), 'owner fixture upload before update/delete');

    await assertDenied(storageUpdate(validPdfPath, owner), 'owner physical update');
    await assertDenied(storageUpdate(validPdfPath, director), 'director physical update');
    await assertDenied(storageUpdate(validPdfPath, outsider), 'outsider physical update');
    await assertDenied(storageDelete(validPdfPath, owner), 'owner physical delete');
    await assertDenied(storageDelete(validPdfPath, director), 'director physical delete');
    await assertDenied(storageDelete(validPdfPath, outsider), 'outsider physical delete');
  });

  it('denies access to another company', async () => {
    await assertDenied(
      storageUpload(documentStoragePath(otherCompanyId, `doc-2-${runId}-${testNumber}`, 'file.pdf'), owner),
      'owner upload to another company',
    );

    await assertAllowed(storageUpload(otherCompanyPdfPath, otherOwner), 'other company owner fixture upload');
    await assertDenied(storageRead(otherCompanyPdfPath, owner), 'owner read from another company');
  });
});
