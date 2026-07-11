const assert = require('node:assert/strict');
const test = require('node:test');
const admin = require('firebase-admin');

const {
  isActiveCompanyEntitlement,
  isFutureDate,
  validateAiPlanAccess,
} = require('../handlers/aiHandler');

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

function mockEntitlement(t, entitlementByCompanyId) {
  Object.defineProperty(admin, 'firestore', {
    configurable: true,
    value: () => ({
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
    }),
  });
  t.after(() => {
    delete admin.firestore;
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
