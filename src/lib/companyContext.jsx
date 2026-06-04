import React, { createContext, useContext, useState, useEffect } from 'react';
import firebase from '@/api/firebaseClient';
import { useAuth } from '@/lib/AuthContext';

const CompanyContext = createContext(null);

export function CompanyProvider({ children }) {
  const { user } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [activeCompany, setActiveCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState([]);

  useEffect(() => {
    if (!user) {
      setCompanies([]);
      setActiveCompany(null);
      setMemberships([]);
      setLoading(false);
      return;
    }

    loadCompanies();
  }, [user]);

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const userUid = user?.uid || user?.id;
      const byUid = userUid
        ? await firebase.entities.CompanyMember.filter({ userUid, status: 'active' }).catch(() => [])
        : [];
      const byEmail = user.email
        ? await firebase.entities.CompanyMember.filter({ userEmail: user.email, status: 'active' }).catch(() => [])
        : [];

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
  };

  const switchCompany = (company) => {
    setActiveCompany(company);
    localStorage.setItem('gemailla_active_company', company.id);
  };

  const getUserRole = () => {
    if (!activeCompany || !user) return null;
    const userUid = user?.uid || user?.id;
    const membership = memberships.find((member) => member.companyId === activeCompany.id);
    return membership?.role || (activeCompany.ownerUid === userUid ? 'director' : null);
  };

  return (
    <CompanyContext.Provider value={{
      companies, activeCompany, switchCompany, loading,
      memberships, getUserRole, reloadCompanies: loadCompanies
    }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used within CompanyProvider');
  return ctx;
}
