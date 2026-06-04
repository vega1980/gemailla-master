import React, { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react';
import firebase from '@/api/firebaseClient';
import { useAuth } from '@/lib/AuthContext';

const SubscriptionContext = createContext(null);

export const PLAN_CONFIG = {
  basic: {
    label: 'Básico',
    monthlyPrice: 0,
    annualPrice: 0,
    predictionLimit: 5,
    aiAccess: false,
    color: 'text-muted-foreground',
    order: 0,
  },
  pro: {
    label: 'Pro',
    monthlyPrice: 499,
    annualPrice: 4990,
    predictionLimit: 50,
    aiAccess: true,
    color: 'text-blue-400',
    order: 1,
  },
  enterprise: {
    label: 'Enterprise',
    monthlyPrice: 1299,
    annualPrice: 12990,
    predictionLimit: Infinity,
    aiAccess: true,
    color: 'text-amber-400',
    order: 2,
  },
};

export function SubscriptionProvider({ children }) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [predictionCount, setPredictionCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const userUid = user?.uid || user?.id;
  const userEmail = user?.email || '';

  const loadSubscription = useCallback(async () => {
    if (!userUid && !userEmail) {
      setSubscription(null);
      setPredictionCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [subsByUid, subsByEmail, logs] = await Promise.all([
        userUid
          ? firebase.entities.Subscription.filter({ userUid, status: 'active' }).catch(() => [])
          : [],
        userEmail
          ? firebase.entities.Subscription.filter({ userEmail, status: 'active' }).catch(() => [])
          : [],
        userEmail
          ? firebase.entities.PredictionLog.filter({ userEmail }).catch(() => [])
          : [],
      ]);
      const subsById = new Map();
      [...subsByUid, ...subsByEmail].forEach((sub) => {
        if (sub?.id) subsById.set(sub.id, sub);
      });
      const subs = Array.from(subsById.values());
      setSubscription(subs[0] || null);
      const thisMonth = new Date().toISOString().slice(0, 7);
      const monthLogs = logs.filter((log) => {
        const generatedAt = log.generatedAt || log.fecha_generacion || log.createdAt || '';
        return generatedAt.startsWith(thisMonth);
      });
      setPredictionCount(monthLogs.length);
    } catch (error) {
      console.error('Error loading subscription:', error);
    } finally {
      setLoading(false);
    }
  }, [userEmail, userUid]);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  const plan = subscription?.plan || 'basic';
  const planCfg = PLAN_CONFIG[plan] || PLAN_CONFIG.basic;

  const canUsePredictions = planCfg.predictionLimit === Infinity || predictionCount < planCfg.predictionLimit;
  const canAccessAI = planCfg.aiAccess;
  const predictionsRemaining = planCfg.predictionLimit === Infinity ? '∞' : Math.max(0, planCfg.predictionLimit - predictionCount);
  const isAtLimit = planCfg.predictionLimit !== Infinity && predictionCount >= planCfg.predictionLimit;

  const logPrediction = useCallback(async (companyId, tipo = 'general', resultado = '') => {
    if (!canUsePredictions) return false;
    try {
      await firebase.entities.PredictionLog.create({
        companyId,
        userEmail,
        generatedAt: new Date().toISOString(),
        predictionType: tipo,
        aiResult: resultado.slice(0, 500),
        planAtCreation: plan,
      });
      setPredictionCount((count) => count + 1);
      return true;
    } catch (error) {
      console.error('Error logging prediction:', error);
      return false;
    }
  }, [canUsePredictions, plan, userEmail]);

  const value = useMemo(() => ({
    subscription,
    plan,
    planCfg,
    loading,
    canUsePredictions,
    canAccessAI,
    predictionsRemaining,
    predictionCount,
    isAtLimit,
    logPrediction,
    reload: loadSubscription,
  }), [
    canAccessAI,
    canUsePredictions,
    isAtLimit,
    loadSubscription,
    loading,
    logPrediction,
    plan,
    planCfg,
    predictionCount,
    predictionsRemaining,
    subscription,
  ]);

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => useContext(SubscriptionContext);