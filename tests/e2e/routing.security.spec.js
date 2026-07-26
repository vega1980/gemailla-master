import { expect, test } from '@playwright/test';
import { clearFirebaseEmulators } from './support/emulatorCleanup.js';
import {
  TEST_PASSWORD,
  createCompany,
  createAndLoginUser,
  loginUser,
  logoutUser,
  signInWithCompany,
  uniqueId,
} from './support/firebaseHarness.js';

test.describe('seguridad de rutas', () => {
  test.beforeEach(async () => {
    await clearFirebaseEmulators();
  });

  test('usuario anónimo en /dashboard redirige a /', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Acceso restringido' })).toBeVisible();
  });

  test('usuario autenticado en / redirige a /dashboard', async ({ page }) => {
    const email = `${uniqueId('routing')}@gemailla-e2e.test`;

    await page.goto('/');
    await createAndLoginUser(page, { email, password: TEST_PASSWORD });
    await page.goto('/');

    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('usuario anónimo en / no dispara consultas empresariales', async ({ page }) => {
    const firestoreRequests = [];

    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('firestore') && url.includes('companyMembers')) {
        firestoreRequests.push(url);
      }
    });

    await page.goto('/');
    await page.waitForTimeout(2000);

    expect(firestoreRequests).toHaveLength(0);
  });

  test('logout purga el contexto empresarial y protege la ruta activa', async ({ page }) => {
    const companyName = uniqueId('empresa-logout');
    await signInWithCompany(page, {
      email: `${uniqueId('logout')}@gemailla-e2e.test`,
      companyId: uniqueId('company'),
      companyName,
    });

    await logoutUser(page);

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Acceso restringido' })).toBeVisible();
    await expect(page.getByText(companyName)).toHaveCount(0);
  });

  test('cambio de usuario no conserva empresas de la sesión anterior', async ({ page }) => {
    const firstEmail = `${uniqueId('first-user')}@gemailla-e2e.test`;
    const secondEmail = `${uniqueId('second-user')}@gemailla-e2e.test`;
    const firstCompanyName = uniqueId('first-company');
    const secondCompanyName = uniqueId('second-company');

    await page.goto('/');
    const firstUser = await createAndLoginUser(page, { email: firstEmail });
    await createCompany(page, {
      companyId: uniqueId('company-a'),
      ownerUid: firstUser.uid,
      ownerEmail: firstEmail,
      name: firstCompanyName,
    });
    await logoutUser(page);

    const secondUser = await createAndLoginUser(page, { email: secondEmail });
    await createCompany(page, {
      companyId: uniqueId('company-b'),
      ownerUid: secondUser.uid,
      ownerEmail: secondEmail,
      name: secondCompanyName,
    });
    await logoutUser(page);

    await loginUser(page, { email: firstEmail });
    await page.goto('/dashboard');
    await expect(page.getByText(firstCompanyName).first()).toBeVisible();

    await logoutUser(page);
    await loginUser(page, { email: secondEmail });
    await page.goto('/dashboard');

    await expect(page.getByText(secondCompanyName).first()).toBeVisible();
    await expect(page.getByText(firstCompanyName)).toHaveCount(0);
  });

  test('una respuesta empresarial atrasada no repuebla la sesión siguiente', async ({ page }) => {
    const firstEmail = `${uniqueId('slow-user')}@gemailla-e2e.test`;
    const secondEmail = `${uniqueId('next-user')}@gemailla-e2e.test`;
    const firstCompanyName = uniqueId('slow-company');
    const secondCompanyName = uniqueId('next-company');

    await page.goto('/');
    const firstUser = await createAndLoginUser(page, { email: firstEmail });
    await createCompany(page, {
      companyId: uniqueId('slow-company-id'),
      ownerUid: firstUser.uid,
      ownerEmail: firstEmail,
      name: firstCompanyName,
    });
    await logoutUser(page);
    const secondUser = await createAndLoginUser(page, { email: secondEmail });
    await createCompany(page, {
      companyId: uniqueId('next-company-id'),
      ownerUid: secondUser.uid,
      ownerEmail: secondEmail,
      name: secondCompanyName,
    });
    await logoutUser(page);

    let delayedRequest;
    const requestWasDelayed = new Promise(resolve => { delayedRequest = resolve; });
    let shouldDelay = true;
    await page.route('**/*', async (route) => {
      if (shouldDelay && route.request().url().includes('firestore')) {
        shouldDelay = false;
        delayedRequest();
        await new Promise(resolve => setTimeout(resolve, 1_500));
      }
      await route.continue();
    });

    await loginUser(page, { email: firstEmail });
    await page.goto('/dashboard');
    await requestWasDelayed;
    await logoutUser(page);
    await loginUser(page, { email: secondEmail });
    await page.goto('/dashboard');

    await expect(page.getByText(secondCompanyName).first()).toBeVisible();
    await page.waitForTimeout(1_600);
    await expect(page.getByText(firstCompanyName)).toHaveCount(0);
  });
});
