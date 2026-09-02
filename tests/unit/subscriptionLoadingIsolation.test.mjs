import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canCompanyEntitlementAccessAI,
  canStartPrediction,
  isCompanyEntitlementActive,
  loadActiveSubscriptions,
  loadCompanyEntitlement,
  loadMonthlyPredictionCount,
} from '../../src/lib/subscriptionData.js';

const entitlementNow = new Date('2026-07-11T12:00:00.000Z');
const futureDate = '2026-07-12T00:00:00.000Z';
const expiredDate = '2026-07-10T00:00:00.000Z';

function createEntitlementEntities(result) {
  const calls = [];
  return {
    calls,
    entities: {
      CompanyEntitlement: {
        getById: async (companyId) => {
          calls.push(companyId);
          return result;
        },
      },
    },
  };
}

test('company entitlement loading fails closed without a valid companyId', async () => {
  for (const companyId of ['', null, undefined]) {
    const fake = createEntitlementEntities({ plan: 'pro' });

    assert.equal(await loadCompanyEntitlement(fake.entities, { companyId }), null);
    assert.deepEqual(fake.calls, []);
  }
});

test('company entitlement loading invokes getById exactly once with the active companyId', async () => {
  const entitlement = { companyId: 'company-1', plan: 'pro' };
  const fake = createEntitlementEntities(entitlement);

  assert.strictEqual(
    await loadCompanyEntitlement(fake.entities, { companyId: 'company-1' }),
    entitlement,
  );
  assert.deepEqual(fake.calls, ['company-1']);
});

test('company entitlement loading returns null when the entitlement does not exist', async () => {
  for (const result of [null, undefined]) {
    const fake = createEntitlementEntities(result);

    assert.equal(
      await loadCompanyEntitlement(fake.entities, { companyId: 'company-1' }),
      null,
    );
  }
});

test('company entitlement loading rejects an entitlement belonging to another company', async () => {
  const fake = createEntitlementEntities({ companyId: 'company-2', plan: 'pro' });

  assert.equal(
    await loadCompanyEntitlement(fake.entities, { companyId: 'company-1' }),
    null,
  );
  assert.deepEqual(fake.calls, ['company-1']);
});

test('company entitlement activity accepts only normalized active statuses', () => {
  for (const status of ['active', 'trialing', 'activo', ' ACTIVE ', 'TRIALING', ' Activo ']) {
    assert.equal(isCompanyEntitlementActive({
      status,
      currentPeriodEnd: futureDate,
    }, entitlementNow), true);
  }

  assert.equal(isCompanyEntitlementActive({
    status: 'cancelled',
    currentPeriodEnd: futureDate,
  }, entitlementNow), false);
});

test('company entitlement activity requires a future current period or grace period', () => {
  assert.equal(isCompanyEntitlementActive({
    status: 'active',
    currentPeriodEnd: futureDate,
  }, entitlementNow), true);
  assert.equal(isCompanyEntitlementActive({
    status: 'active',
    currentPeriodEnd: expiredDate,
  }, entitlementNow), false);
  assert.equal(isCompanyEntitlementActive({
    status: 'active',
    currentPeriodEnd: expiredDate,
    graceUntil: futureDate,
  }, entitlementNow), true);
  assert.equal(isCompanyEntitlementActive({
    status: 'active',
    currentPeriodEnd: expiredDate,
    graceUntil: expiredDate,
  }, entitlementNow), false);
  assert.equal(isCompanyEntitlementActive({
    status: 'active',
    currentPeriodEnd: entitlementNow,
  }, entitlementNow), false);
});

test('company entitlement activity supports only backend-compatible date representations', () => {
  const futureEpoch = Date.parse(futureDate);
  const acceptedDates = [
    new Date(futureDate),
    futureDate,
    futureEpoch,
    { toDate: () => new Date(futureDate) },
  ];

  for (const currentPeriodEnd of acceptedDates) {
    assert.equal(isCompanyEntitlementActive({
      status: 'active',
      currentPeriodEnd,
    }, entitlementNow), true);
  }

  for (const currentPeriodEnd of [
    'not-a-date',
    { seconds: Math.floor(futureEpoch / 1000) },
    { toMillis: () => futureEpoch },
  ]) {
    assert.equal(isCompanyEntitlementActive({
      status: 'active',
      currentPeriodEnd,
    }, entitlementNow), false);
  }
});

test('company entitlement AI access requires an active eligible plan and explicit access flag', () => {
  const activeEntitlement = {
    status: 'active',
    currentPeriodEnd: futureDate,
  };

  assert.equal(canCompanyEntitlementAccessAI({
    ...activeEntitlement,
    plan: ' Pro ',
    aiAccess: true,
  }, entitlementNow), true);
  assert.equal(canCompanyEntitlementAccessAI({
    ...activeEntitlement,
    plan: 'ENTERPRISE',
    aiAccess: true,
  }, entitlementNow), true);

  for (const aiAccess of [false, null, undefined]) {
    assert.equal(canCompanyEntitlementAccessAI({
      ...activeEntitlement,
      plan: 'pro',
      ...(aiAccess === undefined ? {} : { aiAccess }),
    }, entitlementNow), false);
  }

  for (const plan of ['basic', 'unknown']) {
    assert.equal(canCompanyEntitlementAccessAI({
      ...activeEntitlement,
      plan,
      aiAccess: true,
    }, entitlementNow), false);
  }

  assert.equal(canCompanyEntitlementAccessAI({
    status: 'active',
    currentPeriodEnd: expiredDate,
    plan: 'pro',
    aiAccess: true,
  }, entitlementNow), false);
});

test('a prediction-log failure is independent from valid subscription data', async () => {
  const paidSubscription = { id: 'subscription-1', plan: 'pro' };
  const entities = {
    Subscription: {
      filter: async (filters) => (filters.userUid ? [paidSubscription] : []),
    },
    PredictionLog: {
      filter: async () => { throw new Error('prediction logs unavailable'); },
    },
  };

  const subscriptions = await loadActiveSubscriptions(entities, {
    userUid: 'user-1',
    userEmail: 'paid@example.com',
  });

  assert.deepEqual(subscriptions, [paidSubscription]);
  await assert.rejects(
    loadMonthlyPredictionCount(entities, {
      companyId: 'company-1',
      userUid: 'user-1',
      monthKey: '2026-08',
    }),
    /prediction logs unavailable/,
  );
  assert.deepEqual(subscriptions, [paidSubscription]);
});

test('monthly prediction usage is queried by company, user and month', async () => {
  const calls = [];
  const entities = {
    PredictionLog: {
      filter: async (filters) => {
        calls.push(filters);
        return [{ companyId: 'company-a', userUid: 'user-1', monthKey: '2026-08' }];
      },
    },
  };

  assert.equal(await loadMonthlyPredictionCount(entities, {
    companyId: 'company-a',
    userUid: 'user-1',
    monthKey: '2026-08',
  }), 1);
  assert.deepEqual(calls, [{
    companyId: 'company-a',
    userUid: 'user-1',
    monthKey: '2026-08',
  }]);
});

test('monthly prediction usage fails closed without every tenant key', async () => {
  let calls = 0;
  const entities = { PredictionLog: { filter: async () => { calls += 1; return []; } } };

  for (const input of [
    { userUid: 'user-1', monthKey: '2026-08' },
    { companyId: 'company-a', monthKey: '2026-08' },
    { companyId: 'company-a', userUid: 'user-1' },
  ]) {
    assert.equal(await loadMonthlyPredictionCount(entities, input), 0);
  }
  assert.equal(calls, 0);
});

test('prediction execution requires a verified quota and no concurrent write', () => {
  assert.equal(canStartPrediction({
    countAvailable: false, writeInFlight: false, count: 0, limit: 5,
  }), false);
  assert.equal(canStartPrediction({
    countAvailable: true, writeInFlight: true, count: 0, limit: 5,
  }), false);
  assert.equal(canStartPrediction({
    countAvailable: true, writeInFlight: false, count: 5, limit: 5,
  }), false);
  assert.equal(canStartPrediction({
    countAvailable: true, writeInFlight: false, count: 4, limit: 5,
  }), true);
});
