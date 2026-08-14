import React, { createContext, useCallback, useContext, useMemo, useRef, useState, useEffect, useLayoutEffect } from 'react';
import firebase from '@/api/firebaseClient';
import { useAuth } from '@/app/providers/AuthProvider';
import { createLatestRequestGuard } from '@/lib/latestRequestGuard';
import { canStartPrediction, loadActiveSubscriptions, loadMonthlyPredictionCount } from '@/lib/subscriptionData';

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
  const [predictionCountAvailable, setPredictionCountAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const sessionIdRef = useRef(user?.uid || user?.id || user?.email || '');
  const requestGuardRef = useRef(createLatestRequestGuard());
  const predictionCountRef = useRef(0);
  const predictionCountAvailableRef = useRef(false);
  const predictionWriteInFlightRef = useRef(null);

  // Purge plan entitlements before paint whenever the authenticated identity changes.
  useLayoutEffect(() => {
    const sessionId = user?.uid || user?.id || user?.email || '';
    if (sessionIdRef.current !== sessionId) {
      requestGuardRef.current.invalidate();
      sessionIdRef.current = sessionId;
      setSubscription(null);
      setPredictionCount(0);
      setPredictionCountAvailable(false);
      predictionCountRef.current = 0;
      predictionCountAvailableRef.current = false;
      predictionWriteInFlightRef.current = null;
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
    const requestToken = requestGuardRef.current.begin();
    const requestSessionId = user?.uid || user?.id || user?.email || '';
    setLoading(true);
    setPredictionCountAvailable(false);
    predictionCountAvailableRef.current = false;
    try {
      const userUid = user?.uid || user?.id;
      const subs = await loadActiveSubscriptions(firebase.entities, {
        userUid,
        userEmail: user?.email,
      });
      if (!mountedRef.current || sessionIdRef.current !== requestSessionId
        || !requestGuardRef.current.isCurrent(requestToken)) return;
      setSubscription(subs[0] || null);

      // Prediction history is operational data, not the source of plan
      // entitlements. A failure here must not discard a valid subscription.
      try {
        const thisMonth = new Date().toISOString().slice(0, 7);
        const monthlyPredictionCount = await loadMonthlyPredictionCount(firebase.entities, {
          userEmail: user?.email,
          month: thisMonth,
        });
        if (!mountedRef.current || sessionIdRef.current !== requestSessionId
          || !requestGuardRef.current.isCurrent(requestToken)) return;
        setPredictionCount(monthlyPredictionCount);
        setPredictionCountAvailable(true);
        predictionCountRef.current = monthlyPredictionCount;
        predictionCountAvailableRef.current = true;
      } catch (predictionError) {
        console.error('Error loading prediction usage:', predictionError);
        if (mountedRef.current && sessionIdRef.current === requestSessionId
          && requestGuardRef.current.isCurrent(requestToken)) {
          // Fail closed for prediction quotas without changing plan access.
          setPredictionCountAvailable(false);
          predictionCountAvailableRef.current = false;
        }
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
      if (mountedRef.current && sessionIdRef.current === requestSessionId
        && requestGuardRef.current.isCurrent(requestToken)) {
        // Fail closed: never retain paid-plan entitlements after a failed refresh.
        setSubscription(null);
        setPredictionCount(0);
        setPredictionCountAvailable(false);
        predictionCountRef.current = 0;
        predictionCountAvailableRef.current = false;
      }
    } finally {
      if (mountedRef.current && sessionIdRef.current === requestSessionId
        && requestGuardRef.current.isCurrent(requestToken)) setLoading(false);
    }
  }, [user]);


  useEffect(() => {
    const userUid = user?.uid || user?.id;
    if (!userUid && !user?.email) {
      setSubscription(null);
      setPredictionCount(0);
      setPredictionCountAvailable(false);
      predictionCountRef.current = 0;
      predictionCountAvailableRef.current = false;
      setLoading(false);
      return;
    }
    loadSubscription();
  }, [loadSubscription, user?.email, user?.id, user?.uid]);

  const plan = subscription?.plan || 'basic';
  const planCfg = PLAN_CONFIG[plan] || PLAN_CONFIG.basic;

  const canUsePredictions = predictionCountAvailable
    && (planCfg.predictionLimit === Infinity || predictionCount < planCfg.predictionLimit);
  const canAccessAI = planCfg.aiAccess;
  const predictionsRemaining = planCfg.predictionLimit === Infinity ? '∞' : Math.max(0, planCfg.predictionLimit - predictionCount);
  const isAtLimit = planCfg.predictionLimit !== Infinity && predictionCount >= planCfg.predictionLimit;

  const logPrediction = useCallback(async (companyId, tipo = 'general', resultado = '') => {
    const predictionLimit = planCfg.predictionLimit;
    if (!canStartPrediction({
      countAvailable: predictionCountAvailableRef.current,
      writeInFlight: predictionWriteInFlightRef.current !== null,
      count: predictionCountRef.current,
      limit: predictionLimit,
    })) return false;
    const requestSessionId = user?.uid || user?.id || user?.email || '';
    const requestUserEmail = user?.email || '';
    if (!requestSessionId || sessionIdRef.current !== requestSessionId) return false;
    const operationToken = Symbol('prediction-write');
    predictionWriteInFlightRef.current = operationToken;
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
      predictionCountRef.current += 1;
      setPredictionCount(predictionCountRef.current);
      return true;
    } catch (error) {
      console.error('Error logging prediction:', error);
      return false;
    } finally {
      if (predictionWriteInFlightRef.current === operationToken) {
        predictionWriteInFlightRef.current = null;
      }
    }
  }, [plan, planCfg.predictionLimit, user]);

  const value = useMemo(() => ({
    subscription,
    plan,
    planCfg,
    loading,
    canUsePredictions,
    canAccessAI,
    predictionsRemaining,
    predictionCount,
    predictionCountAvailable,
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
    predictionCountAvailable,
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
