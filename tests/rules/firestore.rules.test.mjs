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
const owner = { uid: 'owner-uid', claims: { email: 'owner@gemailla.test', email_verified: true, companyId, companyRole: 'owner' } };
const director = { uid: 'director-uid', claims: { email: 'director@gemailla.test', email_verified: true, companyId, companyRole: 'director' } };
const admin = { uid: 'admin-uid', claims: { email: 'admin@gemailla.test', email_verified: true, companyId, companyRole: 'admin' } };
const editor = { uid: 'editor-uid', claims: { email: 'editor@gemailla.test', email_verified: true, companyId, companyRole: 'editor' } };
const viewer = { uid: 'viewer-uid', claims: { email: 'viewer@gemailla.test', email_verified: true, companyId, companyRole: 'viewer' } };
const inactive = { uid: 'inactive-uid', claims: { email: 'inactive@gemailla.test', email_verified: true, companyId, companyRole: 'editor' } };
const outsider = { uid: 'outsider-uid', claims: { email: 'outsider@gemailla.test', email_verified: true, companyId: otherCompanyId, companyRole: 'admin' } };
const legacyEmailUser = { uid: 'legacy-new-uid', claims: { email: 'legacy@gemailla.test', email_verified: true, companyId, companyRole: 'director' } };

async function seedFirestoreAcl() {
  await seedCompany({
    companyId,
    ownerUid: owner.uid,
    memberships: [
      { userUid: director.uid, userEmail: director.claims.email, role: 'director', status: 'active' },
      { userUid: admin.uid, userEmail: admin.claims.email, role: 'admin', status: 'active' },
      { userUid: editor.uid, userEmail: editor.claims.email, role: 'editor', status: 'active' },
      { userUid: viewer.uid, userEmail: viewer.claims.email, role: 'viewer', status: 'active' },
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
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: owner.uid,
  }), 'admin protected document seed');

  await assertAllowed(firestoreSet('transactions/protected-tx', {
    companyId,
    ownerUid: owner.uid,
    status: 'active',
    type: 'ingreso',
    amount: 100,
  }), 'admin protected transaction seed');

  await assertAllowed(firestoreSet('subscriptions/company-subscription', {
    companyId,
    ownerUid: owner.uid,
    status: 'active',
    plan: 'pro',
  }), 'admin company subscription seed');

  await assertAllowed(firestoreSet('subscriptions/outsider-subscription', {
    ownerUid: outsider.uid,
    status: 'active',
    plan: 'basic',
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
    }, owner), 'owner company update');
    await assertDenied(firestoreDelete(`companies/${companyId}`, owner), 'owner physical company delete');
  });

  it('allows an active admin to manage permitted resources', async () => {
    await assertAllowed(firestoreSet(`companyMembers/${companyId}_new_viewer`, {
      companyId,
      userUid: 'new-viewer-uid',
      userEmail: 'new-viewer@gemailla.test',
      role: 'viewer',
      status: 'pending',
      createdBy: admin.uid,
    }, admin), 'admin membership invite create');

    await assertAllowed(firestorePatch(`companyMembers/${companyId}_${viewer.uid}`, {
      companyId,
      userUid: viewer.uid,
      userEmail: viewer.claims.email,
      role: 'editor',
      status: 'active',
      updatedBy: admin.uid,
    }, admin), 'admin membership role update');
  });

  it('allows an active editor to modify permitted documents', async () => {
    await assertAllowed(firestoreGet('documents/protected-doc', editor), 'editor document read');
    await assertAllowed(firestorePatch('documents/protected-doc', {
      companyId,
      ownerUid: owner.uid,
      title: 'Documento actualizado por editor',
      status: 'active',
      contentType: 'application/pdf',
      fileSize: 100,
      storagePath: `companies/${companyId}/documents/protected-doc/file.pdf`,
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: owner.uid,
      updatedBy: editor.uid,
    }, editor), 'editor document update');
  });

  it('allows a viewer to read but not write permitted company records', async () => {
    await assertAllowed(firestoreGet('documents/protected-doc', viewer), 'viewer document read');
    await assertDenied(firestorePatch('documents/protected-doc', {
      companyId,
      ownerUid: owner.uid,
      title: 'Viewer no puede escribir',
      status: 'active',
      contentType: 'application/pdf',
      fileSize: 100,
      storagePath: `companies/${companyId}/documents/protected-doc/file.pdf`,
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: owner.uid,
      updatedBy: viewer.uid,
    }, viewer), 'viewer document update');
  });

  it('allows an active director to access permitted company collections', async () => {
    await assertAllowed(firestoreGet('documents/protected-doc', director), 'director document read');

    await assertAllowed(firestoreSet('transactions/director-created-tx', {
      companyId,
      ownerUid: director.uid,
      status: 'active',
      type: 'gasto',
      amount: 25,
    }, director), 'director transaction create');
    await assertAllowed(firestoreGet('transactions/protected-tx', director), 'director transaction read');
  });

  it('denies reads and writes from unauthenticated requests', async () => {
    await assertDenied(firestoreGet(`companies/${companyId}`, null), 'anonymous company read');
    await assertDenied(firestoreSet('documents/anonymous-doc', {
      companyId,
      ownerUid: 'anonymous',
      title: 'No autenticado',
      status: 'uploading',
      contentType: 'application/pdf',
      fileSize: 100,
    }, null), 'anonymous document create');
  });

  it('denies users from other companies', async () => {
    await seedCompany({ companyId: 'company-foreign', ownerUid: 'foreign-owner-uid', memberships: [
      { userUid: outsider.uid, userEmail: outsider.claims.email, role: 'admin', status: 'active' },
    ] });

    await assertDenied(firestoreGet('documents/protected-doc', outsider), 'other company admin document read');
    await assertDenied(firestorePatch('transactions/protected-tx', {
      companyId,
      ownerUid: owner.uid,
      status: 'active',
      type: 'ingreso',
      amount: 300,
    }, outsider), 'other company admin transaction update');
  });

  it('denies editor administration actions', async () => {
    await assertDenied(firestoreSet(`companyMembers/${companyId}_editor_invite`, {
      companyId,
      userUid: 'editor-invite-uid',
      userEmail: 'editor-invite@gemailla.test',
      role: 'viewer',
      status: 'pending',
      createdBy: editor.uid,
    }, editor), 'editor membership invite create');

    await assertDenied(firestorePatch(`companies/${companyId}`, {
      name: 'Editor no administra empresa',
      ownerUid: owner.uid,
      status: 'active',
      updatedBy: editor.uid,
    }, editor), 'editor company update');
  });

  it('denies protected field changes and cross-company writes', async () => {
    await assertDenied(firestorePatch('documents/protected-doc', {
      companyId,
      ownerUid: owner.uid,
      title: 'Intenta cambiar createdAt',
      status: 'active',
      contentType: 'application/pdf',
      fileSize: 100,
      storagePath: `companies/${companyId}/documents/protected-doc/file.pdf`,
      createdAt: '2026-02-01T00:00:00.000Z',
      createdBy: owner.uid,
      updatedBy: editor.uid,
    }, editor), 'editor protected createdAt change');

    await assertDenied(firestorePatch('documents/protected-doc', {
      companyId: otherCompanyId,
      ownerUid: owner.uid,
      title: 'Intenta mover tenant',
      status: 'active',
      contentType: 'application/pdf',
      fileSize: 100,
      storagePath: `companies/${otherCompanyId}/documents/protected-doc/file.pdf`,
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: owner.uid,
      updatedBy: editor.uid,
    }, editor), 'editor cross-company document update');

    await assertDenied(firestoreSet('documents/cross-company-create', {
      companyId: otherCompanyId,
      ownerUid: editor.uid,
      title: 'Alta cruzada no permitida',
      status: 'uploading',
      contentType: 'application/pdf',
      fileSize: 100,
    }, editor), 'editor cross-company document create');
  });

  it('denies protected company data to an inactive member', async () => {
    await assertDenied(firestoreGet('documents/protected-doc', inactive), 'inactive member document read');
    await assertDenied(firestorePatch('transactions/protected-tx', {
      companyId,
      ownerUid: owner.uid,
      status: 'active',
      type: 'ingreso',
      amount: 200,
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
    }, outsider), 'outsider document create');
  });

  it('does not allow legacy email-only users to access protected data without a consolidated UID membership', async () => {
    await assertDenied(
      firestoreGet(`companyMembers/${companyId}_legacy_email_only`, legacyEmailUser),
      'legacy email-only user cannot read an email-only membership record',
    );
    await assertDenied(firestoreGet('documents/protected-doc', legacyEmailUser), 'legacy email-only user document read');
    await assertDenied(firestoreGet('transactions/protected-tx', legacyEmailUser), 'legacy email-only user transaction read');
  });

  it('allows UID-based member reads when the auth token has no email claim', async () => {
    const noEmailViewer = { uid: viewer.uid, claims: { email_verified: true, companyId, companyRole: 'viewer' } };

    await assertAllowed(
      firestoreGet(`companyMembers/${companyId}_${viewer.uid}`, noEmailViewer),
      'uid member can read their membership without email claim',
    );
    await assertAllowed(firestoreGet('documents/protected-doc', noEmailViewer), 'uid member can read document without email claim');
    await assertDenied(
      firestoreGet(`companyMembers/${companyId}_legacy_email_only`, noEmailViewer),
      'uid member without email claim cannot read unrelated email-only membership',
    );
  });

  it('denies company records when the auth companyId claim does not match the document tenant', async () => {
    const mismatchedEditor = {
      uid: editor.uid,
      claims: { email: editor.claims.email, email_verified: true, companyId: otherCompanyId, companyRole: 'editor' },
    };

    await assertDenied(firestoreGet('documents/protected-doc', mismatchedEditor), 'mismatched claim document read');
    await assertDenied(firestorePatch('transactions/protected-tx', {
      companyId,
      ownerUid: owner.uid,
      status: 'active',
      type: 'ingreso',
      amount: 400,
    }, mismatchedEditor), 'mismatched claim transaction update');
  });

  it('blocks user profile role escalation and keeps AI/audit writes backend-only', async () => {
    await assertAllowed(firestoreSet(`users/${viewer.uid}`, {
      displayName: 'Viewer seguro',
      createdBy: viewer.uid,
    }, viewer), 'viewer user profile create without role');

    await assertDenied(firestoreSet(`users/${editor.uid}`, {
      displayName: 'Editor admin falso',
      role: 'admin',
      createdBy: editor.uid,
    }, editor), 'user profile create with role');

    await assertDenied(firestorePatch(`users/${viewer.uid}`, {
      displayName: 'Viewer escalado',
      role: 'admin',
      updatedBy: viewer.uid,
    }, viewer), 'user profile role escalation update');

    await assertDenied(firestoreSet('auditLogs/client-created-log', {
      companyId,
      action: 'client-write',
      createdBy: admin.uid,
    }, admin), 'client audit log write');

    await assertDenied(firestoreSet('aiUsage/client-created-usage', {
      companyId,
      tokens: 100,
    }, admin), 'client ai usage write');

    await assertAllowed(firestoreSet('aiBudgets/company-budget', {
      companyId,
      dailyLimitUsd: 25,
    }, admin), 'admin ai budget write');
    await assertDenied(firestoreSet('aiBudgets/viewer-budget', {
      companyId,
      dailyLimitUsd: 999,
    }, viewer), 'viewer ai budget write');
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
    }, director), 'user-owned subscription create');
    await assertAllowed(firestoreSet('subscriptions/director-company-subscription', {
      companyId,
      ownerUid: director.uid,
      status: 'active',
      plan: 'pro',
    }, director), 'company subscription create by director');
  });
});
