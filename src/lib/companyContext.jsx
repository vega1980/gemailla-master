import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getSavedActiveCompanyId, saveActiveCompanyId } from '@/features/companies/services/activeCompanyStorage';
import { loadCompanyContextData } from '@/features/companies/services/companyMembershipService';
import { firebase } from '@/api/firebaseClient';

const CompanyContext = createContext(null);

export function CompanyProvider({ children }) {
  const { user } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [activeCompany, setActiveCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState([]);
  const mountedRef = useRef(true);
  const syncInProgressRef = useRef(false);
  const pendingSyncCompanyRef = useRef(null);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const loadCompanies = useCallback(async (options = {}) => {
    if (!user) {
      setCompanies([]);
      setActiveCompany(null);
      setMemberships([]);
      setLoading(false);
      return;
    }

    const { signal } = options;
    setLoading(true);
    try {
      const { memberships: members, companies: validCompanies } = await loadCompanyContextData(user, { signal });

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
    loadCompanies({ signal: abortController.signal });
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
      await firebase.functions.invoke('syncCompanyClaims', { companyId: company.id });
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
