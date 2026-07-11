// @ts-check

import { firebase } from '@/api/firebaseClient';

const ACTIVE_STATUS = 'active';
const DEFAULT_INITIAL_OWNER_ROLE = 'owner';

export async function loadCompanyMemberships(user) {
  const userUid = user?.uid || user?.id;

  if (!userUid) {
    return [];
  }

  return firebase.entities.CompanyMember.filter({
    userUid,
    status: ACTIVE_STATUS,
  });
}

export async function loadCompaniesForMemberships(memberships, options = {}) {
  const companyIds = [...new Set(memberships.map((member) => member.companyId).filter(Boolean))];
  if (firebase.entities.Company.getMany) {
    return firebase.entities.Company.getMany(companyIds, options).catch(() => []);
  }

  return (
    await Promise.all(companyIds.map((companyId) => firebase.entities.Company.get(companyId).catch(() => null)))
  ).filter(Boolean);
}

export async function loadCompanyContextData(user, options = {}) {
  const memberships = await loadCompanyMemberships(user);
  const companies = await loadCompaniesForMemberships(memberships, options);
  return { memberships, companies };
}

export async function loadActiveMembersForCompanies(companies = [], options = {}) {
  const companyIds = companies.map((company) => company?.id).filter(Boolean);
  if (companyIds.length === 0) return [];

  if (firebase.entities.CompanyMember.filterIn) {
    return firebase.entities.CompanyMember.filterIn('companyId', companyIds, {
      status: ACTIVE_STATUS,
    }, options).catch(() => []);
  }

  const memberLists = await Promise.all(
    companyIds.map((companyId) => firebase.entities.CompanyMember.filter({
      companyId,
      status: ACTIVE_STATUS,
    }).catch(() => [])),
  );

  return memberLists.flat();
}

export function groupMembersByCompany(members = []) {
  return members.reduce((accumulator, member) => {
    if (!member?.companyId || member.status !== ACTIVE_STATUS) return accumulator;
    if (!accumulator[member.companyId]) accumulator[member.companyId] = [];
    accumulator[member.companyId].push(member);
    return accumulator;
  }, {});
}

export async function createCompanyForCurrentUser(companyData = {}, user = {}) {
  const company = await firebase.entities.Company.createCompanyWithInitialOwner(companyData, {
    userEmail: user.email,
    userName: user.fullName || user.displayName || user.email || '',
    role: DEFAULT_INITIAL_OWNER_ROLE,
    status: ACTIVE_STATUS,
  });

  return company;
}

export async function addCompanyMember(companyId, memberData = {}) {
  if (!companyId) throw new Error('companyId es obligatorio para agregar miembros.');
  return firebase.entities.CompanyMember.create({
    companyId,
    userEmail: memberData.userEmail,
    userName: memberData.userName || '',
    role: memberData.role,
    status: ACTIVE_STATUS,
  });
}
