import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getSavedActiveCompanyId, saveActiveCompanyId } from '@/features/companies/services/activeCompanyStorage';
import { loadCompanyContextData } from '@/features/companies/services/companyMembershipService';
import { firebase } from '@/api/firebaseClient';
import { CorrelationScope, getScopedCorrelationId } from '@/lib/correlationScopes';
import { ensureCorrelationId, logFrontendEvent } from '@/lib/observability';
import { printTraceTree, registerTrace } from '@/lib/traceDebugger';

const CompanyContext = createContext(null);
const isDevelopment = Boolean(import.meta.env?.DEV || import.meta.env?.MODE === 'development');

function getUserEmailPrefix(email) {
  if (typeof email !== 'string' || !email.includes('@')) return '';
  return `${email.split('@')[0]}@...`;
}

function getNowMs() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

export function CompanyProvider({ children }) {
  const { user } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [activeCompany, setActiveCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState([]);
  const mountedRef = useRef(true);
  const syncInProgressRef = useRef(false);
  const pendingSyncCompanyRef = useRef(null);
  const pageCorrelationIdRef = useRef(getScopedCorrelationId(CorrelationScope.PAGE));
  const providerStartTimeRef = useRef(getNowMs());
  const operationCountRef = useRef(0);
  const latestSessionMetricsRef = useRef({ companiesLoaded: 0 });
  const userContextRef = useRef({});
  const previousUserIdRef = useRef(user?.uid || user?.id || '');

  const flushProviderSessionMetrics = useCallback(() => {
    const durationMs = Math.round(getNowMs() - providerStartTimeRef.current);
    logFrontendEvent('provider_session', {
      correlationId: pageCorrelationIdRef.current,
      durationMs,
      operations: operationCountRef.current,
      companiesLoaded: latestSessionMetricsRef.current.companiesLoaded,
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    registerTrace(pageCorrelationIdRef.current, null, 'CompanyProvider');

    return () => {
      mountedRef.current = false;
      flushProviderSessionMetrics();
      if (isDevelopment) printTraceTree(pageCorrelationIdRef.current);
    };
  }, [flushProviderSessionMetrics]);

  const userContext = useMemo(() => ({
    userId: user?.uid || user?.id || '',
    userEmailPrefix: getUserEmailPrefix(user?.email),
    companyCount: companies.length,
    activeCompanyId: activeCompany?.id || '',
  }), [activeCompany, companies.length, user]);

  useEffect(() => {
    userContextRef.current = userContext;
    latestSessionMetricsRef.current = { companiesLoaded: companies.length };
  }, [companies.length, userContext]);

  useEffect(() => {
    const currentUserId = user?.uid || user?.id || '';
    const previousUserId = previousUserIdRef.current;

    if (!currentUserId && previousUserId) {
      flushProviderSessionMetrics();
      pageCorrelationIdRef.current = getScopedCorrelationId(CorrelationScope.PAGE);
      registerTrace(pageCorrelationIdRef.current, null, 'CompanyProvider');
      providerStartTimeRef.current = getNowMs();
      operationCountRef.current = 0;
      latestSessionMetricsRef.current = { companiesLoaded: 0 };
    }

    previousUserIdRef.current = currentUserId;
  }, [flushProviderSessionMetrics, user]);

  const loadCompanies = useCallback(async (options = {}) => {
    if (!user) {
      setCompanies([]);
      setActiveCompany(null);
      setMemberships([]);
      setLoading(false);
      return;
    }

    const { signal } = options;
    const correlationId = ensureCorrelationId(options.correlationId || pageCorrelationIdRef.current, CorrelationScope.PAGE);
    const parentCorrelationId = options.parentCorrelationId;
    operationCountRef.current += 1;
    registerTrace(correlationId, parentCorrelationId, 'company_load');
    logFrontendEvent('company_operation', {
      correlationId,
      parentCorrelationId,
      ...userContextRef.current,
      operation: 'load',
    });
    setLoading(true);
    try {
      const { memberships: members, companies: validCompanies } = await loadCompanyContextData(user, {
        signal,
        correlationId,
        parentCorrelationId,
      });

      if (!mountedRef.current || signal?.aborted) return;
      setMemberships(members);
      setCompanies(validCompanies);

      const savedId = getSavedActiveCompanyId();
      const saved = validCompanies.find((company) => company.id === savedId);
      setActiveCompany(saved || validCompanies[0] || null);
    } catch (error) {
      console.error('Error loading companies:', error);
      if (!mountedRef.current || signal?.aborted) return;
      setCompanies([]);
      setActiveCompany(null);
      setMemberships([]);
    } finally {
      if (mountedRef.current && !signal?.aborted) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const abortController = new AbortController();
    loadCompanies({
      signal: abortController.signal,
      correlationId: pageCorrelationIdRef.current,
    });
    return () => {
      abortController.abort();
    };
  }, [loadCompanies]);

  const syncActiveCompanyClaims = useCallback(async (company) => {
    if (!company?.id || !user) return;
    if (syncInProgressRef.current) {
      pendingSyncCompanyRef.current = company;
      return;
    }
    syncInProgressRef.current = true;
    try {
      const claimsCorrelationId = ensureCorrelationId('', 'company_claims');
      await firebase.functions.invoke('syncCompanyClaims', {
        companyId: company.id,
        correlationId: claimsCorrelationId,
        parentCorrelationId: pageCorrelationIdRef.current,
      });
      operationCountRef.current += 1;
      registerTrace(claimsCorrelationId, pageCorrelationIdRef.current, 'syncCompanyClaims');
      logFrontendEvent('company_operation', {
        correlationId: claimsCorrelationId,
        parentCorrelationId: pageCorrelationIdRef.current,
        ...userContextRef.current,
        activeCompanyId: company.id,
        operation: 'sync_claims',
      });
      await user.getIdToken(true);
    } catch (error) {
      console.warn('No se pudieron sincronizar los claims de empresa activa:', error);
    } finally {
      syncInProgressRef.current = false;
      const pendingCompany = pendingSyncCompanyRef.current;
      pendingSyncCompanyRef.current = null;
      if (pendingCompany?.id && pendingCompany.id !== company.id) {
        syncActiveCompanyClaims(pendingCompany);
      }
    }
  }, [user]);

  useEffect(() => {
    syncActiveCompanyClaims(activeCompany);
  }, [activeCompany, syncActiveCompanyClaims]);

  const switchCompany = useCallback((company) => {
    if (!company?.id) return;
    setActiveCompany(company);
    saveActiveCompanyId(company.id);
    syncActiveCompanyClaims(company);
  }, [syncActiveCompanyClaims]);

  const value = useMemo(() => ({
    companies,
    activeCompany,
    loading,
    memberships,
    switchCompany,
    reloadCompanies: loadCompanies,
  }), [activeCompany, companies, loadCompanies, loading, memberships, switchCompany]);

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used within CompanyProvider');
  return ctx;
}
