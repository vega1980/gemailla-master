const assert = require('node:assert/strict');
const test = require('node:test');
const firebaseAdmin = require('../firebaseAdmin');

const {
  validateAiPlanAccess,
} = require('../handlers/aiHandler');
const {
  evaluateCompanyEntitlement,
  isActiveCompanyEntitlement,
  isFutureDate,
} = require('../policies/companyEntitlementPolicy');

const fixedNow = new Date('2026-07-11T12:00:00.000Z');

test('AI entitlement date parser accepts Firestore Timestamp-like values, Date, epoch number and ISO string', () => {
  assert.equal(isFutureDate({ toDate: () => new Date('2026-07-12T00:00:00.000Z') }, fixedNow), true);
  assert.equal(isFutureDate(new Date('2026-07-12T00:00:00.000Z'), fixedNow), true);
  assert.equal(isFutureDate(Date.parse('2026-07-12T00:00:00.000Z'), fixedNow), true);
  assert.equal(isFutureDate('2026-07-12T00:00:00.000Z', fixedNow), true);

  assert.equal(isFutureDate({ toDate: () => new Date('2026-07-10T00:00:00.000Z') }, fixedNow), false);
  assert.equal(isFutureDate('not-a-date', fixedNow), false);
  assert.equal(isFutureDate({ seconds: 1783819200 }, fixedNow), false);
});

test('active company entitlement requires active status and current or grace period', () => {
  assert.equal(isActiveCompanyEntitlement({
    status: 'active',
    currentPeriodEnd: { toDate: () => new Date('2026-07-12T00:00:00.000Z') },
  }, fixedNow), true);

  assert.equal(isActiveCompanyEntitlement({
    status: 'active',
    currentPeriodEnd: '2026-07-10T00:00:00.000Z',
    graceUntil: new Date('2026-07-12T00:00:00.000Z'),
  }, fixedNow), true);

  assert.equal(isActiveCompanyEntitlement({
    status: 'active',
    currentPeriodEnd: '2026-07-10T00:00:00.000Z',
    graceUntil: '2026-07-10T01:00:00.000Z',
  }, fixedNow), false);

  assert.equal(isActiveCompanyEntitlement({
    status: 'cancelled',
    currentPeriodEnd: '2026-07-12T00:00:00.000Z',
  }, fixedNow), false);
});

test('shared entitlement policy normalizes plan and fails closed across tenants', () => {
  const active = {
    companyId: 'company-a',
    status: ' trialing ',
    currentPeriodEnd: '2026-07-12T00:00:00.000Z',
    plan: ' Pro ',
    aiAccess: true,
  };

  assert.deepEqual(evaluateCompanyEntitlement(active, 'company-a', fixedNow), {
    active: true,
    canAccessAI: true,
    canRecordPredictions: true,
    plan: 'pro',
    tenantMatches: true,
  });
  assert.deepEqual(evaluateCompanyEntitlement(active, 'company-b', fixedNow), {
    active: false,
    canAccessAI: false,
    canRecordPredictions: false,
    plan: 'basic',
    tenantMatches: false,
  });
});

test('shared entitlement policy covers canonical plan and validity matrix', () => {
  const entitlement = (overrides = {}) => ({
    companyId: 'company-a',
    status: 'active',
    currentPeriodEnd: '2026-07-12T00:00:00.000Z',
    plan: 'pro',
    aiAccess: true,
    ...overrides,
  });

  assert.equal(evaluateCompanyEntitlement(null, 'company-a', fixedNow).canAccessAI, false);
  assert.equal(evaluateCompanyEntitlement(entitlement({ plan: 'basic' }), 'company-a', fixedNow).canAccessAI, false);
  assert.equal(evaluateCompanyEntitlement(entitlement({ plan: 'pro' }), 'company-a', fixedNow).canAccessAI, true);
  assert.equal(evaluateCompanyEntitlement(entitlement({ plan: 'enterprise' }), 'company-a', fixedNow).canAccessAI, true);
  assert.equal(evaluateCompanyEntitlement(entitlement({ currentPeriodEnd: '2026-07-10T00:00:00.000Z' }), 'company-a', fixedNow).canAccessAI, false);
  assert.equal(evaluateCompanyEntitlement(entitlement({ currentPeriodEnd: '2026-07-10T00:00:00.000Z', graceUntil: '2026-07-12T00:00:00.000Z' }), 'company-a', fixedNow).canAccessAI, true);
  assert.equal(evaluateCompanyEntitlement(entitlement({ currentPeriodEnd: '2026-07-10T00:00:00.000Z', graceUntil: '2026-07-10T00:00:00.000Z' }), 'company-a', fixedNow).canAccessAI, false);
  assert.equal(evaluateCompanyEntitlement(entitlement({ status: 'cancelled' }), 'company-a', fixedNow).canAccessAI, false);
  assert.equal(evaluateCompanyEntitlement(entitlement({ aiAccess: false }), 'company-a', fixedNow).canAccessAI, false);
  assert.equal(evaluateCompanyEntitlement(entitlement({ companyId: 'company-b' }), 'company-a', fixedNow).canAccessAI, false);
  assert.equal(evaluateCompanyEntitlement(entitlement({ plan: 'unknown' }), 'company-a', fixedNow).canAccessAI, false);
});

test('prediction entitlement capability is independent from AI access', () => {
  const entitlement = (overrides = {}) => ({
    companyId: 'company-a',
    status: 'active',
    currentPeriodEnd: '2026-07-12T00:00:00.000Z',
    plan: 'basic',
    aiAccess: false,
    ...overrides,
  });

  assert.equal(evaluateCompanyEntitlement(entitlement(), 'company-a', fixedNow).canRecordPredictions, true);
  assert.equal(evaluateCompanyEntitlement(null, 'company-a', fixedNow).canRecordPredictions, true);
  assert.equal(evaluateCompanyEntitlement(entitlement({ plan: 'unknown' }), 'company-a', fixedNow).canRecordPredictions, false);
  assert.equal(evaluateCompanyEntitlement(entitlement({ status: 'cancelled' }), 'company-a', fixedNow).canRecordPredictions, false);
  assert.equal(evaluateCompanyEntitlement(entitlement({ companyId: 'company-b' }), 'company-a', fixedNow).canRecordPredictions, false);
});

function mockEntitlement(t, entitlementByCompanyId) {
  const originalGetAdminFirestore = firebaseAdmin.getAdminFirestore;
  firebaseAdmin.getAdminFirestore = () => ({
      collection: (collectionName) => {
        assert.equal(collectionName, 'companyEntitlements');
        return {
          doc: (companyId) => ({
            get: async () => {
              const data = entitlementByCompanyId[companyId];
              return {
                exists: Boolean(data),
                id: companyId,
                data: () => data,
              };
            },
          }),
        };
      },
    });
  t.after(() => {
    firebaseAdmin.getAdminFirestore = originalGetAdminFirestore;
  });
}

test('AI entitlement validation blocks expired entitlement and allows grace period', async (t) => {
  mockEntitlement(t, {
    expired: {
      companyId: 'expired',
      plan: 'pro',
      status: 'active',
      aiAccess: true,
      currentPeriodEnd: '2000-01-01T00:00:00.000Z',
      graceUntil: '2000-01-02T00:00:00.000Z',
    },
    grace: {
      companyId: 'grace',
      plan: 'pro',
      status: 'active',
      aiAccess: true,
      currentPeriodEnd: '2000-01-01T00:00:00.000Z',
      graceUntil: '2999-01-01T00:00:00.000Z',
    },
  });

  await assert.rejects(
    () => validateAiPlanAccess({ companyId: 'expired' }),
    /entitlement activo/,
  );
  await assert.doesNotReject(() => validateAiPlanAccess({ companyId: 'grace' }));
});

test('AI entitlement validation is scoped to the requested company id', async (t) => {
  mockEntitlement(t, {
    companyA: {
      companyId: 'companyA',
      plan: 'pro',
      status: 'active',
      aiAccess: true,
      currentPeriodEnd: '2999-01-01T00:00:00.000Z',
    },
    companyB: {
      companyId: 'companyB',
      plan: 'basic',
      status: 'active',
      aiAccess: false,
      currentPeriodEnd: '2999-01-01T00:00:00.000Z',
    },
    companyC: {
      companyId: 'companyC',
      plan: 'pro',
      status: 'active',
      aiAccess: false,
      currentPeriodEnd: '2999-01-01T00:00:00.000Z',
    },
  });

  await assert.doesNotReject(() => validateAiPlanAccess({ companyId: 'companyA' }));
  await assert.rejects(
    () => validateAiPlanAccess({ companyId: 'companyB' }),
    /plan actual no habilita IA/,
  );
  await assert.rejects(
    () => validateAiPlanAccess({ companyId: 'companyC' }),
    /plan actual no habilita IA/,
  );
});
