import { beforeEach, describe, it } from 'node:test';
import {
  assertAllowed,
  assertDenied,
  clearFirestore,
  firestorePatch,
  firestoreSet,
  seedCompany,
} from './rules-test-utils.mjs';

const companyA = 'companyA';
const companyB = 'companyB';
const ownerA = { uid: 'ownerA', claims: { companyId: companyA, companyRole: 'owner', membershipStatus: 'active' } };
const adminA = { uid: 'adminA', claims: { companyId: companyA, companyRole: 'admin', membershipStatus: 'active' } };
const attacker = { uid: 'attacker', claims: { companyId: companyB, companyRole: 'editor', membershipStatus: 'active' } };

async function seedSecurityAcl() {
  await seedCompany({
    companyId: companyA,
    ownerUid: ownerA.uid,
    memberships: [
      { userUid: ownerA.uid, role: 'owner', status: 'active' },
      { userUid: adminA.uid, role: 'admin', status: 'active' },
    ],
  });

  await seedCompany({
    companyId: companyB,
    ownerUid: 'ownerB',
    memberships: [
      { userUid: attacker.uid, role: 'editor', status: 'active' },
    ],
  });
}

describe('C1 — cross-tenant injection', () => {
  const collections = ['aiConversations', 'subscriptions', 'predictionLogs', 'observabilityEvents'];

  beforeEach(async () => {
    await clearFirestore();
    await seedSecurityAcl();
  });

  for (const collection of collections) {
    it(`denies creating ${collection} with a foreign companyId and own ownerUid`, async () => {
      await assertDenied(firestoreSet(`${collection}/evil1`, {
        ownerUid: attacker.uid,
        companyId: companyA,
        payload: 'inyectado',
      }, attacker), `${collection} cross-tenant create`);
    });

    it(`allows creating a personal ${collection} document without companyId`, async () => {
      await assertAllowed(firestoreSet(`${collection}/mine1`, {
        ownerUid: attacker.uid,
        note: 'documento personal legítimo',
      }, attacker), `${collection} personal create`);
    });

    it(`allows creating ${collection} in the actor company`, async () => {
      await assertAllowed(firestoreSet(`${collection}/ok1`, {
        ownerUid: attacker.uid,
        companyId: companyB,
      }, attacker), `${collection} own company create`);
    });
  }

  it('denies hijacking a personal document by injecting a foreign companyId on update', async () => {
    await assertAllowed(firestoreSet('aiConversations/hijack', {
      ownerUid: attacker.uid,
    }, attacker), 'personal ai conversation create');

    await assertDenied(firestorePatch('aiConversations/hijack', {
      ownerUid: attacker.uid,
      companyId: companyA,
    }, attacker), 'personal ai conversation foreign companyId update');
  });
});

describe('A1 — role escalation via companyMembers', () => {
  beforeEach(async () => {
    await clearFirestore();
    await seedSecurityAcl();
  });

  it('denies an admin creating an owner membership', async () => {
    await assertDenied(firestoreSet(`companyMembers/${companyA}_puppet`, {
      companyId: companyA,
      userUid: 'puppet',
      role: 'owner',
      status: 'active',
    }, adminA), 'admin owner membership create');
  });

  it('denies an admin creating a director membership', async () => {
    await assertDenied(firestoreSet(`companyMembers/${companyA}_dir`, {
      companyId: companyA,
      userUid: 'dir',
      role: 'director',
      status: 'active',
    }, adminA), 'admin director membership create');
  });

  it('denies an admin self-promoting to owner on update', async () => {
    await assertDenied(firestorePatch(`companyMembers/${companyA}_${adminA.uid}`, {
      companyId: companyA,
      userUid: adminA.uid,
      role: 'owner',
      status: 'active',
    }, adminA), 'admin self-promotion update');
  });

  it('allows an admin creating an editor membership', async () => {
    await assertAllowed(firestoreSet(`companyMembers/${companyA}_ed`, {
      companyId: companyA,
      userUid: 'ed',
      role: 'editor',
      status: 'active',
    }, adminA), 'admin editor membership create');
  });

  it('allows the real owner assigning director', async () => {
    await assertAllowed(firestoreSet(`companyMembers/${companyA}_dir2`, {
      companyId: companyA,
      userUid: 'dir2',
      role: 'director',
      status: 'active',
    }, ownerA), 'owner director membership create');
  });
});
