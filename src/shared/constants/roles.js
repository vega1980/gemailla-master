// @ts-check

export const ROLES = Object.freeze({
  OWNER: 'owner',
  DIRECTOR: 'director',
  ADMIN: 'admin',
  EDITOR: 'editor',
  VIEWER: 'viewer',
  GUEST: 'invitado',
});

/** @type {readonly ['owner', 'director', 'admin', 'editor', 'viewer', 'invitado']} */
export const COMPANY_ROLES = [ROLES.OWNER, ROLES.DIRECTOR, ROLES.ADMIN, ROLES.EDITOR, ROLES.VIEWER, ROLES.GUEST];

/** @type {readonly ['director', 'admin', 'editor', 'viewer', 'invitado']} */
export const INVITABLE_COMPANY_ROLES = [ROLES.DIRECTOR, ROLES.ADMIN, ROLES.EDITOR, ROLES.VIEWER, ROLES.GUEST];

/** @type {readonly []} */
export const LEGACY_COMPANY_ROLES = [];
