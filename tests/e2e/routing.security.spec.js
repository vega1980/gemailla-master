import { expect, test } from '@playwright/test';
import { clearFirebaseEmulators } from './support/emulatorCleanup.js';
import {
  TEST_PASSWORD,
  createAndLoginUser,
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
});
