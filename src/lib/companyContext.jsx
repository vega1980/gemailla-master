import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import firebase from '@/api/firebaseClient';
import { useAuth } from '@/lib/AuthContext';

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
      const userUid = user?.uid || user?.id;
      const [byUid, byEmail] = await Promise.all([
        userUid
          ? firebase.entities.CompanyMember.filter({ userUid, status: 'active' }).catch(() => [])
          : [],
        user.email
          ? firebase.entities.CompanyMember.filter({ userEmail: user.email, status: 'active' }).catch(() => [])
          : [],
      ]);

      const membersById = new Map();
      [...byUid, ...byEmail].forEach((member) => {
        if (member?.id) membersById.set(member.id, member);
      });

      const members = Array.from(membersById.values());
      setMemberships(members);

      const companyIds = [...new Set(members.map((member) => member.companyId).filter(Boolean))];
      const validCompanies = (
        await Promise.all(companyIds.map((companyId) => firebase.entities.Company.get(companyId).catch(() => null)))
      ).filter(Boolean);

      setCompanies(validCompanies);

      const savedId = localStorage.getItem('gemailla_active_company');
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
    localStorage.setItem('gemailla_active_company', company.id);
  }, []);

  const getUserRole = useCallback(() => {
    if (!activeCompany || !user) return null;
    const userUid = user?.uid || user?.id;
    const membership = memberships.find((member) => member.companyId === activeCompany.id);
    return membership?.role || (activeCompany.ownerUid === userUid ? 'director' : null);
  }, [activeCompany, memberships, user]);

  const value = useMemo(() => ({
    companies,
    activeCompany,
    switchCompany,
    loading,
    memberships,
    getUserRole,
    reloadCompanies: loadCompanies,
  }), [activeCompany, companies, getUserRole, loadCompanies, loading, memberships, switchCompany]);

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
