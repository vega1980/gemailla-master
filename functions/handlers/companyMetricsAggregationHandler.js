const admin = require('firebase-admin');

const EVENT_COLLECTION = 'companyMetricAggregationEvents';
const ZERO_METRIC_FIELDS = Object.freeze({
  totalIncome: 0,
  totalExpenses: 0,
  netCashFlow: 0,
  transactionCount: 0,
  documentCount: 0,
  pendingDocumentCount: 0,
  criticalKpiCount: 0,
});
const ZERO_MONTHLY_FIELDS = Object.freeze({
  totalIncome: 0,
  totalExpenses: 0,
  netCashFlow: 0,
  transactionCount: 0,
});

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function getMonthKey(value) {
  const date = value?.toDate?.() || (value ? new Date(value) : new Date());
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 7);
  return date.toISOString().slice(0, 7);
}

function getEventData(event = {}) {
  return {
    before: event.data?.before?.data?.() || null,
    after: event.data?.after?.data?.() || null,
  };
}

function getChangedCompanyIds(event = {}) {
  const { before, after } = getEventData(event);
  return [...new Set([before?.companyId, after?.companyId].filter(Boolean).map(String))];
}

function addDelta(target, patch) {
  for (const [key, value] of Object.entries(patch)) {
    target[key] = toNumber(target[key]) + toNumber(value);
  }
}

function getTransactionContribution(transaction) {
  if (!transaction?.companyId) return null;
  const amount = toNumber(transaction.amount);
  const type = String(transaction.type || '').toLowerCase();
  const contribution = {
    companyId: String(transaction.companyId),
    month: getMonthKey(transaction.date || transaction.createdAt || transaction.updatedAt),
    metrics: { transactionCount: 1 },
    monthly: { transactionCount: 1 },
  };
  if (type === 'ingreso') {
    contribution.metrics.totalIncome = amount;
    contribution.metrics.netCashFlow = amount;
    contribution.monthly.totalIncome = amount;
    contribution.monthly.netCashFlow = amount;
  } else if (type === 'gasto') {
    contribution.metrics.totalExpenses = amount;
    contribution.metrics.netCashFlow = -amount;
    contribution.monthly.totalExpenses = amount;
    contribution.monthly.netCashFlow = -amount;
  }
  return contribution;
}

function getDocumentContribution(document) {
  if (!document?.companyId) return null;
  const status = String(document.status || '').toLowerCase();
  return {
    companyId: String(document.companyId),
    metrics: {
      documentCount: 1,
      pendingDocumentCount: ['pending', 'processing'].includes(status) ? 1 : 0,
    },
  };
}

function getKpiContribution(kpi) {
  if (!kpi?.companyId) return null;
  const status = String(kpi.status || '').toLowerCase();
  return {
    companyId: String(kpi.companyId),
    metrics: {
      criticalKpiCount: ['critico', 'en_riesgo'].includes(status) ? 1 : 0,
    },
  };
}

function getContributionForCollection(collectionName, data) {
  if (collectionName === 'transactions') return getTransactionContribution(data);
  if (collectionName === 'documents') return getDocumentContribution(data);
  if (collectionName === 'kpis') return getKpiContribution(data);
  return null;
}

function invertContribution(contribution) {
  if (!contribution) return null;
  const invert = (values = {}) => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, -toNumber(value)]));
  return {
    companyId: contribution.companyId,
    month: contribution.month,
    metrics: invert(contribution.metrics),
    monthly: invert(contribution.monthly),
  };
}

function mergeContribution(target, contribution) {
  if (!contribution?.companyId) return;
  if (!target.companyMetrics.has(contribution.companyId)) target.companyMetrics.set(contribution.companyId, {});
  addDelta(target.companyMetrics.get(contribution.companyId), contribution.metrics || {});

  if (contribution.month) {
    const key = `${contribution.companyId}_${contribution.month}`;
    if (!target.monthlyMetrics.has(key)) {
      target.monthlyMetrics.set(key, { companyId: contribution.companyId, month: contribution.month, delta: {} });
    }
    addDelta(target.monthlyMetrics.get(key).delta, contribution.monthly || {});
  }
}

function buildMetricDeltas({ before, after, collectionName }) {
  const deltas = { companyMetrics: new Map(), monthlyMetrics: new Map() };
  mergeContribution(deltas, invertContribution(getContributionForCollection(collectionName, before)));
  mergeContribution(deltas, getContributionForCollection(collectionName, after));
  return deltas;
}

function collectionNameFromEvent(event = {}) {
  const rawPath = event.document || event.subject || event.params?.collectionName || '';
  const match = String(rawPath).match(/documents\/([^/]+)\/[^/]+$/);
  if (match) return match[1];
  if (event.params?.transactionId) return 'transactions';
  if (event.params?.documentId) return 'documents';
  if (event.params?.kpiId) return 'kpis';
  return '';
}

function withIncrements(values, FieldValue) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, FieldValue.increment(toNumber(value))]));
}

async function aggregateCompanyMetricsOnWrite(event = {}) {
  const db = admin.firestore();
  const FieldValue = admin.firestore.FieldValue;
  const eventId = String(event.id || event.eventId || '').trim();
  if (!eventId) return { skipped: true, reason: 'missing_eventId' };

  const collectionName = collectionNameFromEvent(event);
  if (!collectionName) return { skipped: true, reason: 'missing_collection' };

  const { before, after } = getEventData(event);
  const deltas = buildMetricDeltas({ before, after, collectionName });
  if (deltas.companyMetrics.size === 0 && deltas.monthlyMetrics.size === 0) return { skipped: true, reason: 'missing_companyId' };

  const eventRef = db.collection(EVENT_COLLECTION).doc(eventId);
  const processedAt = new Date().toISOString();

  return db.runTransaction(async (transaction) => {
    const eventSnap = await transaction.get(eventRef);
    if (eventSnap.exists) return { skipped: true, reason: 'duplicate_event' };

    const companyIds = [...deltas.companyMetrics.keys()];
    transaction.set(eventRef, { eventId, collectionName, companyIds, processedAt }, { merge: false });

    for (const [companyId, delta] of deltas.companyMetrics.entries()) {
      transaction.set(db.collection('companyMetrics').doc(companyId), {
        ...ZERO_METRIC_FIELDS,
        companyId,
        ...withIncrements(delta, FieldValue),
        updatedAt: processedAt,
        lastEventId: eventId,
      }, { merge: true });
    }

    for (const [metricId, { companyId, month, delta }] of deltas.monthlyMetrics.entries()) {
      transaction.set(db.collection('companyMonthlyMetrics').doc(metricId), {
        ...ZERO_MONTHLY_FIELDS,
        companyId,
        month,
        ...withIncrements(delta, FieldValue),
        updatedAt: processedAt,
        lastEventId: eventId,
      }, { merge: true });
    }

    return {
      skipped: false,
      companyIds,
      monthlyMetricIds: [...deltas.monthlyMetrics.keys()],
    };
  });
}

module.exports = {
  aggregateCompanyMetricsOnWrite,
  buildMetricDeltas,
  collectionNameFromEvent,
  getChangedCompanyIds,
  getMonthKey,
};
