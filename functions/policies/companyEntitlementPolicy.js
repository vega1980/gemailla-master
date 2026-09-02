const AI_ENABLED_PLANS = new Set(['pro', 'enterprise']);
const PREDICTION_ENABLED_PLANS = new Set(['basic', 'pro', 'enterprise']);

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

function isActiveCompanyEntitlement(entitlement, now = new Date()) {
  const status = String(entitlement?.status || '').trim().toLowerCase();
  if (!['active', 'trialing', 'activo'].includes(status)) return false;
  if (isFutureDate(entitlement.currentPeriodEnd, now)) return true;
  return isFutureDate(entitlement.graceUntil, now);
}

function evaluateCompanyEntitlement(entitlement, companyId, now = new Date()) {
  const hasCompanyId = typeof companyId === 'string' && companyId !== '';
  const entitlementPresent = entitlement != null;
  const tenantMatches = hasCompanyId && entitlementPresent && entitlement.companyId === companyId;
  const active = tenantMatches && isActiveCompanyEntitlement(entitlement, now);
  const plan = active ? String(entitlement?.plan || '').trim().toLowerCase() : '';
  const canAccessAI = active && AI_ENABLED_PLANS.has(plan) && entitlement.aiAccess === true;
  const usesLegacyBasicFallback = hasCompanyId && !entitlementPresent;
  const canRecordPredictions = usesLegacyBasicFallback
    || (active && PREDICTION_ENABLED_PLANS.has(plan));

  return Object.freeze({
    active,
    canAccessAI,
    canRecordPredictions,
    plan: usesLegacyBasicFallback || !active ? 'basic' : plan,
    tenantMatches,
  });
}

module.exports = {
  AI_ENABLED_PLANS,
  PREDICTION_ENABLED_PLANS,
  evaluateCompanyEntitlement,
  isActiveCompanyEntitlement,
  isFutureDate,
};
