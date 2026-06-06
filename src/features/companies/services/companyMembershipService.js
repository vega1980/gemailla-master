// @ts-check

import firebase from '@/api/firebaseClient';

function uniqueById(records) {
  const recordsById = new Map();
  records.forEach((record) => {
    if (record?.id) recordsById.set(record.id, record);
  });
  return Array.from(recordsById.values());
}

export async function loadCompanyMemberships(user) {
  const userUid = user?.uid || user?.id;
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
