// @ts-check

import firebase from '@/api/firebaseClient';
import { auth } from '@/infrastructure/firebase/auth';

function compareMembershipsByCreation(a, b) {
  return String(a?.createdAt || '').localeCompare(String(b?.createdAt || ''))
    || String(a?.companyId || '').localeCompare(String(b?.companyId || ''))
    || String(a?.id || '').localeCompare(String(b?.id || ''));
}

function uniqueById(records) {
  const recordsById = new Map();
  records.forEach((record) => {
    if (record?.id) recordsById.set(record.id, record);
  });
  return Array.from(recordsById.values()).sort(compareMembershipsByCreation);
}

async function getActiveCompanyClaim() {
  const currentUser = auth?.currentUser;
  if (!currentUser?.getIdTokenResult) return null;
  const tokenResult = await currentUser.getIdTokenResult().catch(() => null);
  const companyId = tokenResult?.claims?.companyId;
  return typeof companyId === 'string' && companyId.trim() ? companyId.trim() : null;
}

export async function loadCompanyMemberships(user) {
  const userUid = user?.uid || user?.id;
  const activeCompanyId = await getActiveCompanyClaim();
  if (userUid && activeCompanyId) {
    const [byId, byEmail] = await Promise.all([
      firebase.entities.CompanyMember.get(`${activeCompanyId}_${userUid}`).catch(() => null),
      user?.email
        ? firebase.entities.CompanyMember.filter({
          companyId: activeCompanyId,
          userEmail: user.email,
          status: 'active',
        }).catch(() => [])
        : [],
    ]);

    return uniqueById([
      byId?.status === 'active' ? byId : null,
      ...byEmail,
    ].filter(Boolean));
  }

  const [byUid, byEmail] = await Promise.all([
    userUid
      ? firebase.entities.CompanyMember.filter({ userUid, status: 'active' }).catch(() => [])
      : [],
    user?.email
      ? firebase.entities.CompanyMember.filter({ userEmail: user.email, status: 'active' }).catch(() => [])
      : [],
  ]);

  return uniqueById([...byUid, ...byEmail]);
}

export async function loadCompaniesForMemberships(memberships) {
  const companyIds = [...new Set(memberships.map((member) => member.companyId).filter(Boolean))];
  return (
    await Promise.all(companyIds.map((companyId) => firebase.entities.Company.get(companyId).catch(() => null)))
  ).filter(Boolean);
}

export async function loadCompanyContextData(user) {
  const memberships = await loadCompanyMemberships(user);
  const companies = await loadCompaniesForMemberships(memberships);
  return { memberships, companies };
}
