import { expect, test } from '@playwright/test';
import path from 'node:path';
import { clearFirebaseEmulators } from './support/emulatorCleanup.js';
import {
  TEST_PASSWORD,
  addCompanyMember,
  createAnalyzableDocument,
  createAndLoginUser,
  createCompany,
  loginUser,
  logoutUser,
  readDocument,
  setActiveCompanyClaims,
  uniqueId,
} from './support/firebaseHarness.js';

const fixturesDir = path.join(process.cwd(), 'tests/e2e/fixtures');

async function signInOwnerWithCompanies(page) {
  const runId = uniqueId('critical');
  const ownerEmail = `${runId}@gemailla-e2e.test`;
  const primaryCompanyId = `${runId}-primary`;
  const secondaryCompanyId = `${runId}-secondary`;

  await page.goto('/');
  const owner = await createAndLoginUser(page, { email: ownerEmail, password: TEST_PASSWORD });
  await createCompany(page, {
    companyId: primaryCompanyId,
    ownerUid: owner.uid,
    ownerEmail,
    name: `Empresa Primaria ${runId}`,
  });
  await createCompany(page, {
    companyId: secondaryCompanyId,
    ownerUid: owner.uid,
    ownerEmail,
    name: `Empresa Secundaria ${runId}`,
  });
  await setActiveCompanyClaims(page, { userUid: owner.uid, companyId: primaryCompanyId, role: 'owner' });

  await page.goto('/dashboard');
  await expect(page.getByText(`Empresa Primaria ${runId}`).first()).toBeVisible({ timeout: 15_000 });

  return { runId, owner, ownerEmail, primaryCompanyId, secondaryCompanyId };
}

test.describe('flujos críticos multi-capa', () => {
  test.beforeEach(async ({ request }) => {
    await clearFirebaseEmulators(request);
  });

  test('login y cambio de empresa activa', async ({ page }) => {
    const { runId } = await signInOwnerWithCompanies(page);

    await page.getByRole('button', { name: /empresa activa/i }).click();
    await page.getByRole('menuitem', { name: new RegExp(`^Empresa Secundaria ${runId}$`) }).click();

    await expect(page.getByRole('button', { name: new RegExp(`Empresa activa: Empresa Secundaria ${runId}`) })).toBeVisible();
  });

  test('upload PDF y XML valida UI, Firestore rules y Storage rules', async ({ page }) => {
    const { runId } = await signInOwnerWithCompanies(page);

    await page.goto('/documents');
    await expect(page.getByRole('heading', { name: 'Documentos', exact: true })).toBeVisible({ timeout: 15_000 });

    await page.locator('#file-upload').setInputFiles(path.join(fixturesDir, 'sample.pdf'));
    await expect(page.getByText('sample.pdf')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Pendiente').first()).toBeVisible();

    await page.locator('#file-upload').setInputFiles(path.join(fixturesDir, 'sample.xml'));
    await expect(page.getByText('sample.xml')).toBeVisible({ timeout: 20_000 });

    await page.getByPlaceholder('Buscar documentos...').fill('sample');
    await expect(page.getByText('sample.pdf')).toBeVisible();
    await expect(page.getByText('sample.xml')).toBeVisible();
    await expect(page.getByText(`Empresa Primaria ${runId}`).first()).toBeVisible();
  });

  test('análisis IA actualiza el documento usando el contrato /api/ai', async ({ page }) => {
    const { runId, owner, primaryCompanyId } = await signInOwnerWithCompanies(page);
    const documentId = `${runId}-doc-ai`;

    await createAnalyzableDocument(page, {
      documentId,
      companyId: primaryCompanyId,
      ownerUid: owner.uid,
      title: 'factura-ia-e2e.pdf',
    });

    await page.route('**/api/ai', async (route) => {
      const body = route.request().postDataJSON();
      expect(body.companyId).toBe(primaryCompanyId);
      expect(body.documentIds).toContain(documentId);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          docType: 'factura',
          rfc_emisor: 'AAA010101AAA',
          rfc_receptor: 'BBB010101BBB',
          subtotal: 100,
          iva: 16,
          total: 116,
          currency: 'MXN',
          ai_summary: 'Factura validada por E2E',
          ai_classification: 'fiscal',
          tags: ['e2e', 'factura'],
          status: 'completed',
          correlationId: body.correlationId,
        }),
      });
    });

    await page.goto('/documents');
    await expect(page.getByText('factura-ia-e2e.pdf')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /analizar documento factura-ia-e2e\.pdf/i }).click();

    await expect(page.getByText('Analizado')).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => readDocument(page, documentId)).toMatchObject({
      status: 'analyzed',
      docType: 'factura',
      total: 116,
    });
  });

  test('restricción por rol viewer bloquea escritura documental', async ({ page }) => {
    const runId = uniqueId('roles');
    const ownerEmail = `${runId}-owner@gemailla-e2e.test`;
    const viewerEmail = `${runId}-viewer@gemailla-e2e.test`;
    const companyId = `${runId}-company`;

    await page.goto('/');
    const owner = await createAndLoginUser(page, { email: ownerEmail, password: TEST_PASSWORD });
    await createCompany(page, {
      companyId,
      ownerUid: owner.uid,
      ownerEmail,
      name: `Empresa Roles ${runId}`,
    });
    await setActiveCompanyClaims(page, { userUid: owner.uid, companyId, role: 'owner' });
    await logoutUser(page);

    const viewer = await createAndLoginUser(page, { email: viewerEmail, password: TEST_PASSWORD });
    await logoutUser(page);

    await loginUser(page, { email: ownerEmail, password: TEST_PASSWORD });
    await addCompanyMember(page, {
      companyId,
      userUid: viewer.uid,
      userEmail: viewerEmail,
      role: 'viewer',
      actorUid: owner.uid,
    });
    await setActiveCompanyClaims(page, { userUid: viewer.uid, companyId, role: 'viewer' });
    await logoutUser(page);

    await loginUser(page, { email: viewerEmail, password: TEST_PASSWORD });
    await page.goto('/documents');
    await expect(page.getByText(`Empresa Roles ${runId}`).first()).toBeVisible({ timeout: 15_000 });

    await page.locator('#file-upload').setInputFiles(path.join(fixturesDir, 'sample.pdf'));
    await expect(page.getByText('No se pudo subir el documento')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('sample.pdf')).toHaveCount(0);
  });

  test('expiración/cierre de sesión redirige fuera de módulos protegidos', async ({ page }) => {
    const { runId } = await signInOwnerWithCompanies(page);

    await expect(page.getByText(`Empresa Primaria ${runId}`).first()).toBeVisible();
    await logoutUser(page);
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
  });
});
