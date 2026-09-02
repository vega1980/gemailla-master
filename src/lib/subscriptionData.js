export async function loadActiveSubscriptions(entities, { userUid, userEmail } = {}) {
  const [byUid, byEmail] = await Promise.all([
    userUid ? entities.Subscription.filter({ userUid, status: 'active' }) : [],
    userEmail ? entities.Subscription.filter({ userEmail, status: 'active' }) : [],
  ]);
  const subscriptionsById = new Map();
  [...byUid, ...byEmail].forEach((subscription) => {
    if (subscription?.id) subscriptionsById.set(subscription.id, subscription);
  });
  return Array.from(subscriptionsById.values());
}

export async function loadCompanyEntitlement(entities, { companyId } = {}) {
  if (typeof companyId !== 'string' || companyId.trim() === '') return null;

  const entitlement = await entities.CompanyEntitlement.getById(companyId);
  if (entitlement == null) return null;
  if (
    Object.prototype.hasOwnProperty.call(entitlement, 'companyId')
    && entitlement.companyId !== companyId
  ) return null;

  return entitlement;
}

function isFutureDate(value, now = new Date()) {
  if (!value) return false;
  let date;
  if (typeof value?.toDate === 'function') {
    date = value.toDate();
  } else if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'number') {
    date = new Date(value);
  } else if (typeof value === 'string') {
    date = new Date(value);
  } else {
    return false;
  }
  return !Number.isNaN(date.getTime()) && date.getTime() > now.getTime();
}

export function isCompanyEntitlementActive(entitlement, now = new Date()) {
  const status = String(entitlement?.status || '').trim().toLowerCase();
  if (!['active', 'trialing', 'activo'].includes(status)) return false;
  if (isFutureDate(entitlement.currentPeriodEnd, now)) return true;
  return isFutureDate(entitlement.graceUntil, now);
}

export function canCompanyEntitlementAccessAI(entitlement, now = new Date()) {
  if (!isCompanyEntitlementActive(entitlement, now)) return false;
  const plan = String(entitlement?.plan || '').trim().toLowerCase();
  return ['pro', 'enterprise'].includes(plan) && entitlement.aiAccess === true;
}

export async function loadMonthlyPredictionCount(entities, { companyId, userUid, monthKey } = {}) {
  if (![companyId, userUid, monthKey].every((value) => (
    typeof value === 'string' && value.trim() !== ''
  ))) return 0;

  const logs = await entities.PredictionLog.filter({ companyId, userUid, monthKey });
  return logs.length;
}

export function canStartPrediction({ countAvailable, writeInFlight, count, limit }) {
  if (!countAvailable || writeInFlight) return false;
  return limit === Infinity || count < limit;
}
