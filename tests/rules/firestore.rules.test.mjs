import { beforeEach, describe, it } from 'node:test';
import {
  assertAllowed,
  assertDenied,
  clearFirestore,
  firestoreDelete,
  firestoreGet,
  firestorePatch,
  firestoreSet,
  seedCompany,
} from './rules-test-utils.mjs';

const companyId = 'company-firestore';
const otherCompanyId = 'company-other';
const owner = { uid: 'owner-uid', claims: { email: 'owner@gemailla.test', email_verified: true } };
const director = { uid: 'director-uid', claims: { email: 'director@gemailla.test', email_verified: true } };
const inactive = { uid: 'inactive-uid', claims: { email: 'inactive@gemailla.test', email_verified: true } };
const outsider = { uid: 'outsider-uid', claims: { email: 'outsider@gemailla.test', email_verified: true } };
const legacyEmailUser = { uid: 'legacy-new-uid', claims: { email: 'legacy@gemailla.test', email_verified: true } };

const TEST_CREATED_AT = '2026-01-01T00:00:00.000Z';
const TEST_UPDATED_AT = '2026-01-02T00:00:00.000Z';

function auditCreate(uid, createdAt = TEST_CREATED_AT) {
  return {
    createdAt,
    createdBy: uid,
    updatedAt: createdAt,
    updatedBy: uid,
  };
}

function auditUpdate(uid, createdBy = owner.uid) {
  return {
    createdAt: TEST_CREATED_AT,
    createdBy,
    updatedAt: TEST_UPDATED_AT,
    updatedBy: uid,
  };
}

async function seedFirestoreAcl() {
  await seedCompany({
    companyId,
    ownerUid: owner.uid,
    memberships: [
      { userUid: director.uid, userEmail: director.claims.email, role: 'director', status: 'active' },
      { userUid: inactive.uid, userEmail: inactive.claims.email, role: 'editor', status: 'archived' },
      {
        id: `${companyId}_legacy_email_only`,
        userEmail: legacyEmailUser.claims.email,
        role: 'director',
        status: 'active',
      },
    ],
  });

  await seedCompany({ companyId: otherCompanyId, ownerUid: 'other-owner-uid' });

  await assertAllowed(firestoreSet('documents/protected-doc', {
    companyId,
    ownerUid: owner.uid,
    title: 'Documento protegido',
    status: 'active',
    contentType: 'application/pdf',
    fileSize: 100,
    storagePath: `companies/${companyId}/documents/protected-doc/file.pdf`,
    ...auditCreate(owner.uid),
  }), 'admin protected document seed');

  await assertAllowed(firestoreSet('transactions/protected-tx', {
    companyId,
    ownerUid: owner.uid,
    status: 'active',
    type: 'ingreso',
    amount: 100,
    ...auditCreate(owner.uid),
  }), 'admin protected transaction seed');

  await assertAllowed(firestoreSet('subscriptions/company-subscription', {
    companyId,
    ownerUid: owner.uid,
    status: 'active',
    plan: 'pro',
    ...auditCreate(owner.uid),
  }), 'admin company subscription seed');

  await assertAllowed(firestoreSet('subscriptions/outsider-subscription', {
    ownerUid: outsider.uid,
    status: 'active',
    plan: 'basic',
    ...auditCreate(outsider.uid),
  }), 'admin user subscription seed');
}

describe('Firestore security rules', () => {
  beforeEach(async () => {
    await clearFirestore();
    await seedFirestoreAcl();
  });

  it('allows the active owner to read and write their company without changing ownerUid', async () => {
    await assertAllowed(firestoreGet(`companies/${companyId}`, owner), 'owner company read');
    await assertAllowed(firestorePatch(`companies/${companyId}`, {
      name: 'Empresa actualizada por owner',
      ownerUid: owner.uid,
      status: 'active',
      ...auditUpdate(owner.uid),
    }, owner), 'owner company update');
    await assertDenied(firestoreDelete(`companies/${companyId}`, owner), 'owner physical company delete');
  });

  it('allows an active director to access permitted company collections', async () => {
    await assertAllowed(firestoreGet('documents/protected-doc', director), 'director document read');
    await assertAllowed(firestorePatch('documents/protected-doc', {
      companyId,
      ownerUid: owner.uid,
      title: 'Documento actualizado por director',
      status: 'active',
      contentType: 'application/pdf',
      fileSize: 100,
      storagePath: `companies/${companyId}/documents/protected-doc/file.pdf`,
      ...auditUpdate(director.uid),
    }, director), 'director document update');

    await assertAllowed(firestoreSet('transactions/director-created-tx', {
      companyId,
      ownerUid: director.uid,
      status: 'active',
      type: 'gasto',
      amount: 25,
      ...auditCreate(director.uid),
    }, director), 'director transaction create');
    await assertAllowed(firestoreGet('transactions/protected-tx', director), 'director transaction read');
  });

  it('denies protected company data to an inactive member', async () => {
    await assertDenied(firestoreGet('documents/protected-doc', inactive), 'inactive member document read');
    await assertDenied(firestorePatch('transactions/protected-tx', {
      companyId,
      ownerUid: owner.uid,
      status: 'active',
      type: 'ingreso',
      amount: 200,
      ...auditUpdate(inactive.uid),
    }, inactive), 'inactive member transaction update');
  });

  it('denies protected company data to a user without membership', async () => {
    await assertDenied(firestoreGet('documents/protected-doc', outsider), 'outsider document read');
    await assertDenied(firestoreSet('documents/outsider-created-doc', {
      companyId,
      ownerUid: outsider.uid,
      title: 'No permitido',
      status: 'active',
      contentType: 'application/pdf',
      fileSize: 100,
      storagePath: `companies/${companyId}/documents/outsider-created-doc/file.pdf`,
      ...auditCreate(outsider.uid),
    }, outsider), 'outsider document create');
  });

  it('requires safe audit fields on creates and updates', async () => {
    await assertDenied(firestoreSet('transactions/director-created-without-audit', {
      companyId,
      ownerUid: director.uid,
      status: 'active',
      type: 'gasto',
      amount: 25,
    }, director), 'director transaction create without audit fields');

    await assertDenied(firestoreSet('transactions/director-created-forged-audit', {
      companyId,
      ownerUid: director.uid,
      status: 'active',
      type: 'gasto',
      amount: 25,
      ...auditCreate(owner.uid),
    }, director), 'director transaction create with forged audit fields');

    await assertDenied(firestorePatch('documents/protected-doc', {
      companyId,
      ownerUid: owner.uid,
      title: 'Documento con auditoría alterada',
      status: 'active',
      contentType: 'application/pdf',
      fileSize: 100,
      storagePath: `companies/${companyId}/documents/protected-doc/file.pdf`,
      ...auditUpdate(director.uid),
      createdBy: director.uid,
    }, director), 'director document update changing createdBy');
  });

  it('does not allow legacy email-only users to access protected data without a consolidated UID membership', async () => {
    await assertAllowed(
      firestoreGet(`companyMembers/${companyId}_legacy_email_only`, legacyEmailUser),
      'legacy email-only user can read their pending/consolidation membership record',
    );
    await assertDenied(firestoreGet('documents/protected-doc', legacyEmailUser), 'legacy email-only user document read');
    await assertDenied(firestoreGet('transactions/protected-tx', legacyEmailUser), 'legacy email-only user transaction read');
  });

  it('allows subscriptions only to permitted users or company members', async () => {
    await assertAllowed(firestoreGet('subscriptions/company-subscription', owner), 'owner company subscription read');
    await assertAllowed(firestoreGet('subscriptions/company-subscription', director), 'director company subscription read');
    await assertDenied(firestoreGet('subscriptions/company-subscription', outsider), 'outsider company subscription read');

    await assertAllowed(firestoreGet('subscriptions/outsider-subscription', outsider), 'ownerUid subscription owner read');
    await assertDenied(firestoreGet('subscriptions/outsider-subscription', director), 'unrelated user subscription read');

    await assertAllowed(firestoreSet('subscriptions/director-owned-subscription', {
      ownerUid: director.uid,
      status: 'active',
      plan: 'basic',
      ...auditCreate(director.uid),
    }, director), 'user-owned subscription create');
    await assertAllowed(firestoreSet('subscriptions/director-company-subscription', {
      companyId,
      ownerUid: director.uid,
      status: 'active',
      plan: 'pro',
      ...auditCreate(director.uid),
    }, director), 'company subscription create by director');
  });
});
