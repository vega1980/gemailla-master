import { beforeEach, describe, it } from 'node:test';
import {
  assertAllowed,
  assertDenied,
  clearFirestore,
  firestoreGet,
  firestorePatch,
  firestoreSet,
  seedCompany,
} from './rules-test-utils.mjs';

const companyA = 'companyA';
const companyB = 'companyB';
const ownerA = { uid: 'ownerA', claims: { companyId: companyA, companyRole: 'owner', membershipStatus: 'active' } };
const adminA = { uid: 'adminA', claims: { companyId: companyA, companyRole: 'admin', membershipStatus: 'active' } };
const attacker = { uid: 'attacker', claims: { companyId: companyB, companyRole: 'editor', membershipStatus: 'active' } };
const archivedA = { uid: 'archivedA', claims: { companyId: companyA, companyRole: 'editor', membershipStatus: 'archived' } };

async function seedSecurityAcl() {
  await seedCompany({
    companyId: companyA,
    ownerUid: ownerA.uid,
    memberships: [
      { userUid: ownerA.uid, role: 'owner', status: 'active' },
      { userUid: adminA.uid, role: 'admin', status: 'active' },
      { userUid: archivedA.uid, role: 'editor', status: 'archived' },
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


describe('hybrid owned/company records', () => {
  beforeEach(async () => {
    await clearFirestore();
    await seedSecurityAcl();
  });

  it('allows an active company member to read and update a company-scoped subscription', async () => {
    await assertAllowed(firestoreSet('subscriptions/companyActive', {
      companyId: companyA,
      ownerUid: ownerA.uid,
      plan: 'pro',
    }), 'seed company subscription');

    await assertAllowed(firestoreGet('subscriptions/companyActive', adminA), 'active member company subscription read');
    await assertAllowed(firestorePatch('subscriptions/companyActive', {
      companyId: companyA,
      ownerUid: ownerA.uid,
      plan: 'business',
    }, adminA), 'active member company subscription update');
  });

  it('denies access to members from another company', async () => {
    await assertAllowed(firestoreSet('subscriptions/companyForeign', {
      companyId: companyA,
      ownerUid: ownerA.uid,
      plan: 'pro',
    }), 'seed foreign subscription');

    await assertDenied(firestoreGet('subscriptions/companyForeign', attacker), 'foreign member company subscription read');
    await assertDenied(firestorePatch('subscriptions/companyForeign', {
      companyId: companyA,
      ownerUid: ownerA.uid,
      plan: 'business',
    }, attacker), 'foreign member company subscription update');
  });

  it('denies access to archived members', async () => {
    await assertAllowed(firestoreSet('subscriptions/companyArchived', {
      companyId: companyA,
      ownerUid: ownerA.uid,
      plan: 'pro',
    }), 'seed archived member subscription');

    await assertDenied(firestoreGet('subscriptions/companyArchived', archivedA), 'archived member company subscription read');
    await assertDenied(firestorePatch('subscriptions/companyArchived', {
      companyId: companyA,
      ownerUid: ownerA.uid,
      plan: 'business',
    }, archivedA), 'archived member company subscription update');
  });

  it('denies archived members even when ownerUid matches on a company-scoped document', async () => {
    await assertAllowed(firestoreSet('subscriptions/companyArchivedOwner', {
      companyId: companyA,
      ownerUid: archivedA.uid,
      plan: 'pro',
    }), 'seed archived owner subscription');

    await assertDenied(firestoreGet('subscriptions/companyArchivedOwner', archivedA), 'archived owner company subscription read');
    await assertDenied(firestorePatch('subscriptions/companyArchivedOwner', {
      companyId: companyA,
      ownerUid: archivedA.uid,
      plan: 'business',
    }, archivedA), 'archived owner company subscription update');
  });

  it('allows users to access strictly personal records they own', async () => {
    await assertAllowed(firestoreSet('subscriptions/personalMine', {
      ownerUid: attacker.uid,
      plan: 'solo',
    }, attacker), 'personal subscription create');

    await assertAllowed(firestoreGet('subscriptions/personalMine', attacker), 'personal subscription read');
    await assertAllowed(firestorePatch('subscriptions/personalMine', {
      ownerUid: attacker.uid,
      plan: 'solo-plus',
    }, attacker), 'personal subscription update');
  });

  it('denies users access to another user personal record', async () => {
    await assertAllowed(firestoreSet('subscriptions/personalOther', {
      ownerUid: ownerA.uid,
      plan: 'solo',
    }, ownerA), 'seed other personal subscription');

    await assertDenied(firestoreGet('subscriptions/personalOther', attacker), 'other personal subscription read');
    await assertDenied(firestorePatch('subscriptions/personalOther', {
      ownerUid: ownerA.uid,
      plan: 'solo-plus',
    }, attacker), 'other personal subscription update');
  });

  it('denies removing companyId from a company-scoped document', async () => {
    await assertAllowed(firestoreSet('subscriptions/noCompanyRemoval', {
      companyId: companyA,
      ownerUid: ownerA.uid,
      plan: 'pro',
    }), 'seed company subscription for companyId removal');

    await assertDenied(firestorePatch('subscriptions/noCompanyRemoval', {
      ownerUid: ownerA.uid,
      plan: 'business',
    }, adminA), 'company subscription companyId removal');
  });

  it('denies removing companyId while keeping ownerUid unchanged', async () => {
    await assertAllowed(firestoreSet('subscriptions/noCompanyIdStrip', {
      companyId: companyA,
      ownerUid: adminA.uid,
      plan: 'pro',
    }), 'seed company subscription for isolated companyId removal');

    await assertDenied(firestorePatch('subscriptions/noCompanyIdStrip', {
      ownerUid: adminA.uid,
      plan: 'solo',
    }, adminA), 'company doc companyId strip with unchanged ownerUid');
  });

  it('denies adding companyId to a personal document', async () => {
    await assertAllowed(firestoreSet('subscriptions/noCompanyAddition', {
      ownerUid: attacker.uid,
      plan: 'solo',
    }, attacker), 'seed personal subscription for companyId addition');

    await assertDenied(firestorePatch('subscriptions/noCompanyAddition', {
      companyId: companyB,
      ownerUid: attacker.uid,
      plan: 'business',
    }, attacker), 'personal subscription companyId addition');
  });

  it('denies transforming a company document into a personal document', async () => {
    await assertAllowed(firestoreSet('subscriptions/noPersonalTransform', {
      companyId: companyA,
      ownerUid: ownerA.uid,
      plan: 'pro',
    }), 'seed company subscription for personal transform');

    await assertDenied(firestorePatch('subscriptions/noPersonalTransform', {
      ownerUid: adminA.uid,
      plan: 'solo',
    }, adminA), 'company subscription personal transform');
  });

  it('denies changing ownerUid to the actor uid', async () => {
    await assertAllowed(firestoreSet('subscriptions/noOwnerTakeover', {
      companyId: companyA,
      ownerUid: ownerA.uid,
      plan: 'pro',
    }), 'seed company subscription for ownerUid takeover');

    await assertDenied(firestorePatch('subscriptions/noOwnerTakeover', {
      companyId: companyA,
      ownerUid: adminA.uid,
      plan: 'business',
    }, adminA), 'company subscription ownerUid takeover');
  });

  it('denies removing ownerUid', async () => {
    await assertAllowed(firestoreSet('subscriptions/noOwnerRemoval', {
      companyId: companyA,
      ownerUid: ownerA.uid,
      plan: 'pro',
    }), 'seed company subscription for ownerUid removal');

    await assertDenied(firestorePatch('subscriptions/noOwnerRemoval', {
      companyId: companyA,
      plan: 'business',
    }, adminA), 'company subscription ownerUid removal');
  });

  it('denies adding ownerUid to an existing document without ownerUid', async () => {
    await assertAllowed(firestoreSet('subscriptions/noOwnerAddition', {
      companyId: companyA,
      plan: 'pro',
    }), 'seed company subscription without ownerUid');

    await assertDenied(firestorePatch('subscriptions/noOwnerAddition', {
      companyId: companyA,
      ownerUid: adminA.uid,
      plan: 'business',
    }, adminA), 'company subscription ownerUid addition');
  });

  it('allows a company editor to update a record created by another member without taking ownerUid', async () => {
    await assertAllowed(firestoreSet('subscriptions/editorUpdateOtherOwner', {
      companyId: companyB,
      ownerUid: 'ownerB',
      plan: 'pro',
    }), 'seed companyB subscription');

    await assertAllowed(firestorePatch('subscriptions/editorUpdateOtherOwner', {
      companyId: companyB,
      ownerUid: 'ownerB',
      plan: 'business',
    }, attacker), 'editor updates without ownerUid takeover');
  });

  it('allows updating a company-scoped legacy document without ownerUid', async () => {
    await assertAllowed(firestoreSet('subscriptions/companyLegacyNoOwner', {
      companyId: companyA,
      plan: 'legacy',
    }), 'seed legacy company subscription without ownerUid');

    await assertAllowed(firestorePatch('subscriptions/companyLegacyNoOwner', {
      companyId: companyA,
      plan: 'business',
    }, adminA), 'update legacy company subscription without ownerUid');
  });

  it('preserves personal and company-scoped subscription cases', async () => {
    await assertAllowed(firestoreSet('subscriptions/subPersonal', {
      ownerUid: attacker.uid,
      plan: 'solo',
    }, attacker), 'subscription personal create');
    await assertAllowed(firestoreSet('subscriptions/subCompany', {
      companyId: companyB,
      ownerUid: attacker.uid,
      plan: 'team',
    }, attacker), 'subscription company create');
  });

  it('preserves personal and company-scoped observability event creation', async () => {
    await assertAllowed(firestoreSet('observabilityEvents/eventPersonal', {
      ownerUid: attacker.uid,
      event: 'personal',
    }, attacker), 'observability personal create');
    await assertAllowed(firestoreSet('observabilityEvents/eventCompany', {
      companyId: companyB,
      ownerUid: attacker.uid,
      event: 'company',
    }, attacker), 'observability company create');
  });

  for (const collection of ['predictionLogs', 'aiConversations']) {
    it(`does not use ownerUid fallback for ${collection} company-scoped reads or updates`, async () => {
      await assertAllowed(firestoreSet(`${collection}/companyNoFallback`, {
        companyId: companyA,
        ownerUid: archivedA.uid,
        prompt: 'company scoped',
      }), `seed ${collection} company no fallback`);

      await assertDenied(firestoreGet(`${collection}/companyNoFallback`, archivedA), `${collection} company read ownerUid fallback`);
      await assertDenied(firestorePatch(`${collection}/companyNoFallback`, {
        companyId: companyA,
        ownerUid: archivedA.uid,
        prompt: 'updated',
      }, archivedA), `${collection} company update ownerUid fallback`);
    });
  }
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
