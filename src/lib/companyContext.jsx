import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getSavedActiveCompanyId, saveActiveCompanyId } from '@/features/companies/services/activeCompanyStorage';
import { loadCompanyContextData } from '@/features/companies/services/companyMembershipService';

const CompanyContext = createContext(null);

export function CompanyProvider({ children }) {
  const { user } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [activeCompany, setActiveCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState([]);

  const loadCompanies = useCallback(async () => {
    if (!user) {
      setCompanies([]);
      setActiveCompany(null);
      setMemberships([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { memberships: members, companies: validCompanies } = await loadCompanyContextData(user);

      setMemberships(members);
      setCompanies(validCompanies);

      const savedId = getSavedActiveCompanyId();
      const saved = validCompanies.find((company) => company.id === savedId);
      setActiveCompany(saved || validCompanies[0] || null);
    } catch (error) {
      console.error('Error loading companies:', error);
      setCompanies([]);
      setActiveCompany(null);
      setMemberships([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  const switchCompany = useCallback((company) => {
    setActiveCompany(company);
    saveActiveCompanyId(company.id);
  }, []);

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
