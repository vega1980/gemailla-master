export const TEST_PASSWORD = 'Gemailla-e2e-12345';

let adminAppPromise;

async function getAdminAuth() {
  if (!adminAppPromise) {
    adminAppPromise = import('node:module').then(({ createRequire }) => {
      process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
      process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
      process.env.GCLOUD_PROJECT ||= process.env.VITE_FIREBASE_PROJECT_ID || 'demo-gemailla-e2e';

      const requireFromFunctions = createRequire(`${process.cwd()}/functions/package.json`);
      const admin = requireFromFunctions('firebase-admin');
      const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'demo-gemailla-e2e';

      if (!admin.apps.length) {
        admin.initializeApp({ projectId });
      }

      return admin.auth();
    });
  }

  return adminAppPromise;
}

export async function setActiveCompanyClaims(page, { userUid, companyId, role = 'owner' }) {
  const auth = await getAdminAuth();
  await auth.setCustomUserClaims(userUid, {
    companyId,
    companyRole: role,
    role,
    membershipStatus: 'active',
  });

  await loadHarness(page);
  await page.evaluate((activeCompanyId) => {
    window.localStorage.setItem('gemailla_active_company', activeCompanyId);
    return window.__gemaillaE2E.refreshCurrentUserToken();
  }, companyId);
}

export function uniqueId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function loadHarness(page) {
  return page.evaluate(async () => {
    const harness = await import('/src/e2e/firebaseTestHarness.js');
    window.__gemaillaE2E = harness;
    return true;
  });
}

export async function createAndLoginUser(page, { email, password = TEST_PASSWORD, displayName }) {
  await loadHarness(page);
  return page.evaluate((payload) => window.__gemaillaE2E.createTestUser(payload), { email, password, displayName });
}

export async function loginUser(page, { email, password = TEST_PASSWORD }) {
  await loadHarness(page);
  return page.evaluate((payload) => window.__gemaillaE2E.loginTestUser(payload), { email, password });
}

export async function logoutUser(page) {
  await loadHarness(page);
  return page.evaluate(() => window.__gemaillaE2E.logoutTestUser());
}

export async function createCompany(page, payload) {
  await loadHarness(page);
  return page.evaluate((company) => window.__gemaillaE2E.createOwnedCompany(company), payload);
}

export async function addCompanyMember(page, payload) {
  await loadHarness(page);
  return page.evaluate((member) => window.__gemaillaE2E.addCompanyMember(member), payload);
}

export async function createAnalyzableDocument(page, payload) {
  await loadHarness(page);
  return page.evaluate((doc) => window.__gemaillaE2E.createAnalyzableDocument(doc), payload);
}

export async function readDocument(page, documentId) {
  await loadHarness(page);
  return page.evaluate((id) => window.__gemaillaE2E.readDocument(id), documentId);
}

export async function signInWithCompany(page, { email, companyId, companyName, role = 'owner' }) {
  await page.goto('/');

  if (role === 'owner') {
    const owner = await createAndLoginUser(page, { email });
    await createCompany(page, {
      companyId,
      ownerUid: owner.uid,
      ownerEmail: email,
      name: companyName,
    });

    await page.goto('/dashboard');
    await page.getByText(companyName).first().waitFor({ timeout: 15_000 });
    return owner;
  }

  const ownerEmail = `${uniqueId('owner')}@gemailla-e2e.test`;
  const owner = await createAndLoginUser(page, { email: ownerEmail });
  await createCompany(page, {
    companyId,
    ownerUid: owner.uid,
    ownerEmail,
    name: companyName,
  });
  await logoutUser(page);

  const member = await createAndLoginUser(page, { email });
  await logoutUser(page);

  await loginUser(page, { email: ownerEmail });
  await addCompanyMember(page, {
    companyId,
    userUid: member.uid,
    userEmail: email,
    role,
    actorUid: owner.uid,
  });
  await logoutUser(page);

  await loginUser(page, { email });
  await page.goto('/dashboard');
  await page.getByText(companyName).first().waitFor({ timeout: 15_000 });
  return member;
}
