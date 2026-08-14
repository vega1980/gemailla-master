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

export async function loadMonthlyPredictionCount(entities, { userEmail, month } = {}) {
  if (!userEmail) return 0;
  const logs = await entities.PredictionLog.filter({ userEmail });
  return logs.filter((log) => log.fecha_generacion?.startsWith(month)).length;
}
