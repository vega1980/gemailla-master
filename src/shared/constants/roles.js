// @ts-check

export const ROLES = Object.freeze({
  DIRECTOR: 'director',
  ADMIN: 'admin',
  MEMBER: 'miembro',
  GUEST: 'invitado',
});

/** @type {readonly [import('@/domain/dtos').CompanyRole, import('@/domain/dtos').CompanyRole, import('@/domain/dtos').CompanyRole, import('@/domain/dtos').CompanyRole]} */
export const COMPANY_ROLES = [ROLES.DIRECTOR, ROLES.ADMIN, ROLES.MEMBER, ROLES.GUEST];
