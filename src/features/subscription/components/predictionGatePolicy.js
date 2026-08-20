export const PredictionGateStatus = Object.freeze({
  LOADING: 'loading',
  PLAN_REQUIRED: 'plan_required',
  QUOTA_UNAVAILABLE: 'quota_unavailable',
  LIMIT_REACHED: 'limit_reached',
  ALLOWED: 'allowed',
});

export function getPredictionGateStatus({
  loading,
  hasRequiredPlan,
  predictionCountAvailable,
  isAtLimit,
}) {
  if (loading) return PredictionGateStatus.LOADING;
  if (!hasRequiredPlan) return PredictionGateStatus.PLAN_REQUIRED;
  if (!predictionCountAvailable) return PredictionGateStatus.QUOTA_UNAVAILABLE;
  if (isAtLimit) return PredictionGateStatus.LIMIT_REACHED;
  return PredictionGateStatus.ALLOWED;
}
