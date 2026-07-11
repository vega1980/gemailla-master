const assert = require('node:assert/strict');
const test = require('node:test');
const admin = require('firebase-admin');

const {
  aggregateCompanyMetricsOnWrite,
  buildMetricDeltas,
  getChangedCompanyIds,
} = require('../handlers/companyMetricsAggregationHandler');

class Snap {
  constructor(id, data) {
    this.id = id;
    this.exists = data !== undefined;
    this._data = data;
  }

  data() {
    return this._data;
  }
}

function applyMerge(previous = {}, value = {}) {
  const next = { ...previous };
  for (const [key, candidate] of Object.entries(value)) {
    if (candidate?.__increment !== undefined) next[key] = Number(next[key] || 0) + candidate.__increment;
    else next[key] = candidate;
  }
  return next;
}

function mockAdmin(t, initial = {}) {
  const store = new Map(Object.entries(initial));
  const makeRef = (collectionName, id) => ({ id, key: `${collectionName}/${id}` });
  const firestore = {
    collection(collectionName) {
      return { doc(id) { return makeRef(collectionName, id); } };
    },
    async runTransaction(callback) {
      return callback({
        async get(ref) { return new Snap(ref.id, store.get(ref.key)); },
        set(ref, value, options = {}) {
          const previous = options.merge ? store.get(ref.key) : {};
          store.set(ref.key, applyMerge(previous, value));
        },
      });
    },
  };
  firestore.FieldValue = { increment: (value) => ({ __increment: value }) };
  Object.defineProperty(admin, 'firestore', { configurable: true, value: () => firestore });
  admin.firestore.FieldValue = firestore.FieldValue;
  t.after(() => { delete admin.firestore; });
  return store;
}

test('getChangedCompanyIds returns before and after companies for cross-company edits', () => {
  assert.deepEqual(getChangedCompanyIds({
    data: {
      before: { data: () => ({ companyId: 'a' }) },
      after: { data: () => ({ companyId: 'b' }) },
    },
  }), ['a', 'b']);
});

test('buildMetricDeltas handles company and month changes without full recompute', () => {
  const deltas = buildMetricDeltas({
    collectionName: 'transactions',
    before: { companyId: 'company-a', type: 'ingreso', amount: 100, date: '2026-06-01T00:00:00.000Z' },
    after: { companyId: 'company-b', type: 'gasto', amount: 40, date: '2026-07-01T00:00:00.000Z' },
  });

  assert.equal(deltas.companyMetrics.get('company-a').totalIncome, -100);
  assert.equal(deltas.companyMetrics.get('company-a').transactionCount, -1);
  assert.equal(deltas.companyMetrics.get('company-b').totalExpenses, 40);
  assert.equal(deltas.companyMetrics.get('company-b').netCashFlow, -40);
  assert.equal(deltas.monthlyMetrics.get('company-a_2026-06').delta.transactionCount, -1);
  assert.equal(deltas.monthlyMetrics.get('company-b_2026-07').delta.transactionCount, 1);
});

test('aggregateCompanyMetricsOnWrite applies atomic deltas and ignores duplicate event ids', async (t) => {
  const store = mockAdmin(t);
  const event = {
    id: 'event-1',
    document: 'projects/demo/databases/(default)/documents/transactions/t1',
    data: {
      before: { data: () => null },
      after: { data: () => ({ companyId: 'company-a', type: 'ingreso', amount: 100, date: '2026-07-03T00:00:00.000Z' }) },
    },
  };

  const first = await aggregateCompanyMetricsOnWrite(event);
  const second = await aggregateCompanyMetricsOnWrite(event);

  assert.equal(first.skipped, false);
  assert.deepEqual(second, { skipped: true, reason: 'duplicate_event' });
  assert.equal(store.get('companyMetrics/company-a').totalIncome, 100);
  assert.equal(store.get('companyMetrics/company-a').netCashFlow, 100);
  assert.equal(store.get('companyMetrics/company-a').transactionCount, 1);
  assert.equal(store.get('companyMonthlyMetrics/company-a_2026-07').transactionCount, 1);
  assert.equal(store.has('companyMetricAggregationEvents/event-1'), true);
});
