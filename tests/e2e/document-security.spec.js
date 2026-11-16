import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { clearFirebaseEmulators, getE2EProjectId } from './support/emulatorCleanup.js';
import { createAndLoginUser, createCompany, setActiveCompanyClaims, uniqueId, TEST_PASSWORD } from './support/firebaseHarness.js';
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { extractPdfText } = require('../../functions/handlers/documentContextBuilder.js');

test('scanned PDF preserves bytes and AI text; foreign and quarantined context is denied by real API', async ({ page }, testInfo) => {
  await clearFirebaseEmulators();
  await page.goto('/');
  const companyId = uniqueId('document-security'), email = `${companyId}@gemailla-e2e.test`;
  const user = await createAndLoginUser(page, { email });
  await createCompany(page, { companyId, ownerUid: user.uid, ownerEmail: email, name: 'Document security' });
  await setActiveCompanyClaims(page, { userUid: user.uid, companyId, role: 'owner' });
  const bucketName = process.env.VITE_FIREBASE_STORAGE_BUCKET;
  const app = initializeApp({ projectId: getE2EProjectId(), storageBucket: bucketName }, companyId);
  const db = getFirestore(app), bucket = getStorage(app).bucket();
  const original = await readFile('tests/e2e/fixtures/sample.pdf');
  await page.goto('/documents');
  await page.locator('#file-upload').setInputFiles('tests/e2e/fixtures/sample.pdf');
  const uploaded = async () => (await db.collection('documents').where('companyId', '==', companyId).get()).docs;
  await expect.poll(async () => (await uploaded()).find(d => d.data().title === 'sample.pdf')?.data().scanStatus, { timeout: 30000 }).toBe('clean');
  const clean = (await uploaded()).find(d => d.data().title === 'sample.pdf');
  expect(clean.data().storagePath).toMatch(new RegExp(`^companies/${companyId}/documents/`));
  const [bytes] = await bucket.file(clean.data().storagePath).download();
  expect(bytes.equals(original)).toBe(true);
  expect(await extractPdfText(bytes)).toContain('GEMAILLA validated PDF invoice total 116.00');

  await page.locator('#file-upload').setInputFiles({ name: 'infected.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nEICAR-STANDARD-ANTIVIRUS-TEST-FILE') });
  await expect.poll(async () => (await uploaded()).find(d => d.data().title === 'infected.pdf')?.data().scanStatus, { timeout: 30000 }).toBe('rejected');
  const rejected = (await uploaded()).find(d => d.data().title === 'infected.pdf');
  expect(rejected.data().storagePath || '').not.toContain(`/documents/${rejected.id}/`);

  const foreignCompany = `${companyId}-foreign`, foreignDocument = `${companyId}-foreign-document`;
  await db.collection('companies').doc(foreignCompany).set({ ownerUid: 'another-owner', status: 'active' });
  await db.collection('documents').doc(foreignDocument).set({ companyId: foreignCompany, storagePath: `companies/${foreignCompany}/documents/private.pdf` });
  const quarantineId = `${companyId}-quarantine`;
  await db.collection('documents').doc(quarantineId).set({ companyId, scanStatus: 'quarantined', storagePath: `companies/${companyId}/quarantine/${quarantineId}/private.pdf` });
  const login = await page.request.post('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key', { data: { email, password: TEST_PASSWORD, returnSecureToken: true } });
  expect(login.ok()).toBe(true);
  const { idToken } = await login.json();
  for (const payload of [
    { companyId: foreignCompany },
    { companyId, documentIds: [foreignDocument] },
    { companyId, documentIds: [quarantineId] },
  ]) {
    const result = await page.request.post('/api/ai', { headers: { Authorization: `Bearer ${idToken}` }, data: { prompt: 'Describe el documento.', ...payload } });
    expect(result.status()).toBe(403);
  }
  await testInfo.attach('document-security-evidence', { contentType: 'application/json', body: JSON.stringify({ cleanDocumentId: clean.id, scanStatus: 'clean', sha256: createHash('sha256').update(bytes).digest('hex'), realPdfExtraction: true, infectedStatus: 'rejected', deniedAiRequests: 3, scanner: 'emulator simulator', geminiLive: false }) });
});
