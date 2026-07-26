import React, { createContext, useCallback, useContext, useMemo, useRef, useState, useEffect, useLayoutEffect } from 'react';
import firebase from '@/api/firebaseClient';
import { useAuth } from '@/app/providers/AuthProvider';

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
  const mountedRef = useRef(true);
  const sessionIdRef = useRef(user?.uid || user?.id || user?.email || '');

  // Purge plan entitlements before paint whenever the authenticated identity changes.
  useLayoutEffect(() => {
    const sessionId = user?.uid || user?.id || user?.email || '';
    if (sessionIdRef.current !== sessionId) {
      sessionIdRef.current = sessionId;
      setSubscription(null);
      setPredictionCount(0);
      setLoading(Boolean(sessionId));
    }
  }, [user]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadSubscription = useCallback(async () => {
    const requestSessionId = user?.uid || user?.id || user?.email || '';
    setLoading(true);
    try {
      const userUid = user?.uid || user?.id;
      const [subsByUid, subsByEmail, logs] = await Promise.all([
        userUid
          ? firebase.entities.Subscription.filter({ userUid, status: 'active' }).catch(() => [])
          : [],
        user?.email
          ? firebase.entities.Subscription.filter({ userEmail: user.email, status: 'active' }).catch(() => [])
          : [],
        user?.email
          ? firebase.entities.PredictionLog.filter({ userEmail: user.email }).catch(() => [])
          : [],
      ]);
      const subsById = new Map();
      [...subsByUid, ...subsByEmail].forEach((sub) => {
        if (sub?.id) subsById.set(sub.id, sub);
      });
      const subs = Array.from(subsById.values());
      if (!mountedRef.current || sessionIdRef.current !== requestSessionId) return;
      setSubscription(subs[0] || null);
      const thisMonth = new Date().toISOString().slice(0, 7);
      const monthLogs = logs.filter(l => l.fecha_generacion?.startsWith(thisMonth));
      setPredictionCount(monthLogs.length);
    } catch (error) {
      console.error('Error loading subscription:', error);
    } finally {
      if (mountedRef.current && sessionIdRef.current === requestSessionId) setLoading(false);
    }
  }, [user]);


  useEffect(() => {
    const userUid = user?.uid || user?.id;
    if (!userUid && !user?.email) {
      setSubscription(null);
      setPredictionCount(0);
      setLoading(false);
      return;
    }
    loadSubscription();
  }, [loadSubscription, user?.email, user?.id, user?.uid]);

  const plan = subscription?.plan || 'basic';
  const planCfg = PLAN_CONFIG[plan] || PLAN_CONFIG.basic;

  const canUsePredictions = planCfg.predictionLimit === Infinity || predictionCount < planCfg.predictionLimit;
  const canAccessAI = planCfg.aiAccess;
  const predictionsRemaining = planCfg.predictionLimit === Infinity ? '∞' : Math.max(0, planCfg.predictionLimit - predictionCount);
  const isAtLimit = planCfg.predictionLimit !== Infinity && predictionCount >= planCfg.predictionLimit;

  const logPrediction = useCallback(async (companyId, tipo = 'general', resultado = '') => {
    if (!canUsePredictions) return false;
    const requestSessionId = user?.uid || user?.id || user?.email || '';
    const requestUserEmail = user?.email || '';
    if (!requestSessionId || sessionIdRef.current !== requestSessionId) return false;
    try {
      await firebase.entities.PredictionLog.create({
        companyId: companyId,
        userEmail: requestUserEmail,
        fecha_generacion: new Date().toISOString(),
        tipo_prediccion: tipo,
        resultado_ia: resultado.slice(0, 500),
        plan_al_momento: plan,
      });
      if (!mountedRef.current || sessionIdRef.current !== requestSessionId) return false;
      setPredictionCount(c => c + 1);
      return true;
    } catch (error) {
      console.error('Error logging prediction:', error);
      return false;
    }
  }, [canUsePredictions, plan, user]);

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
