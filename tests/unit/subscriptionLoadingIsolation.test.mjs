import assert from 'node:assert/strict';
import test from 'node:test';

import {
  loadActiveSubscriptions,
  loadMonthlyPredictionCount,
} from '../../src/lib/subscriptionData.js';

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
      userEmail: 'paid@example.com',
      month: '2026-08',
    }),
    /prediction logs unavailable/,
  );
  assert.deepEqual(subscriptions, [paidSubscription]);
});

test('monthly prediction usage only counts matching records', async () => {
  const entities = {
    PredictionLog: {
      filter: async () => [
        { fecha_generacion: '2026-08-01T00:00:00.000Z' },
        { fecha_generacion: '2026-07-31T23:59:59.000Z' },
        {},
      ],
    },
  };

  assert.equal(await loadMonthlyPredictionCount(entities, {
    userEmail: 'paid@example.com',
    month: '2026-08',
  }), 1);
});
