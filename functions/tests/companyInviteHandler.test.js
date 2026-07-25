const assert = require('node:assert/strict');
const test = require('node:test');
const admin = require('firebase-admin');

const {
  acceptCompanyInvitationHandler,
  hashInviteToken,
  inviteCompanyMemberHandler,
} = require('../handlers/companyInviteHandler');

class Snap {
  constructor(id, data) {
    this.id = id;
    this.exists = data !== undefined;
    this._data = data;
  }

  data() {
    return this._data;
  }
}

function req({ body, uid = 'admin-uid', email = 'admin@gemailla.test', emailVerified = true }) {
  return {
    method: 'POST',
    body,
    get(name) {
      return String(name).toLowerCase() === 'authorization' ? `Bearer ${uid}:${email}:${emailVerified}` : '';
    },
  };
}

function res() {
  return {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

function mockAdmin(t, initial = {}, options = {}) {
  const store = new Map(Object.entries(initial));
  let autoId = 0;
  const firestore = {
    collection(collectionName) {
      return {
        doc(id = `invite-${++autoId}`) {
          const key = `${collectionName}/${id}`;
          return {
            id,
            key,
            async get() { return new Snap(id, store.get(key)); },
            async set(value) { store.set(key, { ...value }); },
            async update(value) { store.set(key, { ...(store.get(key) || {}), ...value }); },
          };
        },
        async add(value) {
          const id = `${collectionName}-${++autoId}`;
          store.set(`${collectionName}/${id}`, { ...value });
          return { id };
        },
      };
    },
    async runTransaction(callback) {
      const staged = new Map([...store.entries()].map(([key, value]) => [key, { ...value }]));
      const result = await callback({
        async get(ref) { return new Snap(ref.id, staged.get(ref.key)); },
        set(ref, value) { staged.set(ref.key, { ...value }); },
        update(ref, value) {
          if (!staged.has(ref.key)) throw new Error(`Missing document: ${ref.key}`);
          if (options.failOnUpdateKey === ref.key) {
            throw new Error(`Forced update failure: ${ref.key}`);
          }
          staged.set(ref.key, { ...staged.get(ref.key), ...value });
        },
      });
      store.clear();
      for (const [key, value] of staged.entries()) store.set(key, value);
      return result;
    },
  };

  Object.defineProperty(admin, 'firestore', { configurable: true, value: () => firestore });
  Object.defineProperty(admin, 'auth', {
    configurable: true,
    value: () => ({
      verifyIdToken: async (token) => {
        const [uid, email, emailVerified] = token.split(':');
        return { uid, email, email_verified: emailVerified === 'true', name: email };
      },
      generateSignInWithEmailLink: async (email, settings) => `https://mail.gemailla.test/?email=${encodeURIComponent(email)}&continue=${encodeURIComponent(settings.url)}`,
    }),
  });
  t.after(() => {
    delete admin.firestore;
    delete admin.auth;
  });

  return store;
}

test('inviteCompanyMember always creates a pending invitation, emails it and does not expose token or link', async (t) => {
  const store = mockAdmin(t, {
    'companies/company-a': { ownerUid: 'admin-uid', status: 'active' },
  });
  const response = res();

  await inviteCompanyMemberHandler(req({ body: { companyId: 'company-a', userEmail: 'member@gemailla.test', role: 'viewer' } }), response);

  assert.equal(response.statusCode, 202);
  assert.equal(response.payload.status, 'invitation_pending');
  assert.equal(response.payload.emailLink, undefined);
  assert.equal(response.payload.token, undefined);
  assert.equal([...store.keys()].some((key) => key.startsWith('companyInvitations/')), true);
  assert.equal([...store.keys()].some((key) => key.startsWith('companyMembers/')), false);
  assert.equal([...store.keys()].some((key) => key.startsWith('mail/')), true);
  const invitation = store.get(`companyInvitations/${response.payload.invitationId}`);
  assert.equal(invitation.status, 'pending');
  assert.equal(typeof invitation.tokenHash, 'string');
  assert.ok(invitation.expiresAt);
});

test('inviteCompanyMember rejects invalid roles', async (t) => {
  mockAdmin(t, { 'companies/company-a': { ownerUid: 'admin-uid', status: 'active' } });
  const response = res();

  await inviteCompanyMemberHandler(req({ body: { companyId: 'company-a', userEmail: 'member@gemailla.test', role: 'owner' } }), response);

  assert.equal(response.statusCode, 400);
});


for (const [actorRole, targetRole, allowed] of [
  ['owner', 'director', true], ['owner', 'admin', true], ['owner', 'editor', true],
  ['owner', 'viewer', true], ['owner', 'invitado', true],
  ['director', 'director', false], ['director', 'admin', true], ['director', 'editor', true],
  ['director', 'viewer', true], ['director', 'invitado', true],
  ['admin', 'director', false], ['admin', 'admin', false], ['admin', 'editor', true],
  ['admin', 'viewer', true], ['admin', 'invitado', true],
  ['editor', 'viewer', false], ['viewer', 'viewer', false], ['invitado', 'viewer', false],
]) {
  test(`${actorRole} ${allowed ? 'can' : 'cannot'} invite ${targetRole}`, async (t) => {
    const uid = `${actorRole}-uid`;
    const initial = {
      'companies/company-a': { ownerUid: actorRole === 'owner' ? uid : 'owner-uid', status: 'active' },
    };
    if (actorRole !== 'owner') {
      initial[`companyMembers/company-a_${uid}`] = {
        companyId: 'company-a', userUid: uid, role: actorRole, status: 'active',
      };
    }
    const store = mockAdmin(t, initial);
    const response = res();
    await inviteCompanyMemberHandler(req({
      uid,
      email: `${actorRole}@gemailla.test`,
      body: { companyId: 'company-a', userEmail: 'member@gemailla.test', role: targetRole },
    }), response);
    assert.equal(response.statusCode, allowed ? 202 : 403);
    assert.equal([...store.keys()].some((key) => key.startsWith('companyInvitations/')), allowed);
  });
}

test('owner membership cannot override the real company owner', async (t) => {
  const store = mockAdmin(t, {
    'companies/company-a': { ownerUid: 'real-owner-uid', status: 'active' },
    'companyMembers/company-a_admin-uid': {
      companyId: 'company-a', userUid: 'admin-uid', role: 'owner', status: 'active',
    },
  });
  const response = res();
  await inviteCompanyMemberHandler(req({
    body: { companyId: 'company-a', userEmail: 'member@gemailla.test', role: 'viewer' },
  }), response);
  assert.equal(response.statusCode, 403);
  assert.equal([...store.keys()].some((key) => key.startsWith('companyInvitations/')), false);
});

test('ownerUid takes precedence over incompatible createdBy legacy data', async (t) => {
  const store = mockAdmin(t, {
    'companies/company-a': { ownerUid: 'real-owner-uid', createdBy: 'admin-uid', status: 'active' },
  });
  const response = res();
  await inviteCompanyMemberHandler(req({
    body: { companyId: 'company-a', userEmail: 'member@gemailla.test', role: 'viewer' },
  }), response);
  assert.equal(response.statusCode, 403);
  assert.equal([...store.keys()].some((key) => key.startsWith('companyInvitations/')), false);
});

test('createdBy remains a temporary owner fallback when ownerUid is missing', async (t) => {
  const store = mockAdmin(t, {
    'companies/company-a': { createdBy: 'admin-uid', status: 'active' },
  });
  const response = res();
  await inviteCompanyMemberHandler(req({
    body: { companyId: 'company-a', userEmail: 'member@gemailla.test', role: 'viewer' },
  }), response);
  assert.equal(response.statusCode, 202);
  assert.equal([...store.keys()].some((key) => key.startsWith('companyInvitations/')), true);
});
test('acceptCompanyInvitation creates canonical membership transactionally', async (t) => {
  const token = 'accept-token';
  const store = mockAdmin(t, {
    'companyInvitations/invite-1': {
      companyId: 'company-a',
      userEmail: 'member@gemailla.test',
      role: 'viewer',
      status: 'pending',
      tokenHash: hashInviteToken(token),
      expiresAt: '2999-01-01T00:00:00.000Z',
      invitedByUid: 'admin-uid',
    },
  });
  const response = res();

  await acceptCompanyInvitationHandler(req({
    uid: 'member-uid',
    email: 'member@gemailla.test',
    body: { invitationId: 'invite-1', token },
  }), response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.membershipId, 'company-a_member-uid');
  assert.equal(store.get('companyMembers/company-a_member-uid').status, 'active');
  assert.equal(store.get('companyInvitations/invite-1').status, 'accepted');
});

test('acceptCompanyInvitation rejects expired tokens and unverified email', async (t) => {
  const token = 'accept-token';
  mockAdmin(t, {
    'companyInvitations/expired': {
      companyId: 'company-a',
      userEmail: 'member@gemailla.test',
      role: 'viewer',
      status: 'pending',
      tokenHash: hashInviteToken(token),
      expiresAt: '2000-01-01T00:00:00.000Z',
      invitedByUid: 'admin-uid',
    },
  });

  const expiredResponse = res();
  await acceptCompanyInvitationHandler(req({
    uid: 'member-uid',
    email: 'member@gemailla.test',
    body: { invitationId: 'expired', token },
  }), expiredResponse);
  assert.equal(expiredResponse.statusCode, 410);

  const unverifiedResponse = res();
  await acceptCompanyInvitationHandler(req({
    uid: 'member-uid',
    email: 'member@gemailla.test',
    emailVerified: false,
    body: { invitationId: 'expired', token },
  }), unverifiedResponse);
  assert.equal(unverifiedResponse.statusCode, 403);
});

for (const status of ['active', 'activo', 'pending']) {
  test(`acceptCompanyInvitation makes an existing ${status} matching membership active`, async (t) => {
    const token = `token-${status}`;
    const createdAt = '2025-01-01T00:00:00.000Z';
    const store = mockAdmin(t, {
      [`companyInvitations/invite-${status}`]: {
        companyId: 'company-a', userEmail: 'member@gemailla.test', role: 'viewer', status: 'pending',
        tokenHash: hashInviteToken(token), expiresAt: '2999-01-01T00:00:00.000Z', invitedByUid: 'admin-uid',
      },
      'companyMembers/company-a_member-uid': {
        companyId: 'company-a', userUid: 'member-uid', userEmail: 'member@gemailla.test',
        role: 'viewer', status, createdAt,
      },
    });
    const response = res();
    await acceptCompanyInvitationHandler(req({
      uid: 'member-uid', email: 'member@gemailla.test', body: { invitationId: `invite-${status}`, token },
    }), response);
    const membership = store.get('companyMembers/company-a_member-uid');
    assert.equal(response.statusCode, 200);
    assert.equal(response.payload.role, 'viewer');
    assert.equal(membership.status, 'active');
    assert.equal(membership.role, 'viewer');
    assert.equal(membership.companyId, 'company-a');
    assert.equal(membership.userUid, 'member-uid');
    assert.equal(membership.createdAt, createdAt);
    assert.equal(store.get(`companyInvitations/invite-${status}`).status, 'accepted');
  });
}

for (const [name, status, role] of [
  ['archived status', 'archived', 'viewer'],
  ['inactive status', 'inactive', 'viewer'],
  ['unknown status', 'disabled', 'viewer'],
  ['different role', 'active', 'editor'],
]) {
  test(`acceptCompanyInvitation rejects existing membership with ${name} atomically`, async (t) => {
    const token = `token-${status}-${role}`;
    const invitationId = `invite-${status}-${role}`;
    const invitationKey = `companyInvitations/${invitationId}`;
    const membershipKey = 'companyMembers/company-a_member-uid';
    const initialMembership = {
      companyId: 'company-a', userUid: 'member-uid', userEmail: 'member@gemailla.test',
      role, status, createdAt: '2025-01-01T00:00:00.000Z',
    };
    const initialInvitation = {
      companyId: 'company-a', userEmail: 'member@gemailla.test', role: 'viewer', status: 'pending',
      tokenHash: hashInviteToken(token), expiresAt: '2999-01-01T00:00:00.000Z', invitedByUid: 'admin-uid',
    };
    const store = mockAdmin(t, { [invitationKey]: initialInvitation, [membershipKey]: initialMembership });
    const response = res();
    await acceptCompanyInvitationHandler(req({
      uid: 'member-uid', email: 'member@gemailla.test', body: { invitationId, token },
    }), response);
    assert.equal(response.statusCode, 409);
    assert.deepEqual(store.get(membershipKey), initialMembership);
    assert.deepEqual(store.get(invitationKey), initialInvitation);
  });
}

for (const [name, identity] of [
  ['companyId', { companyId: 'company-b', userUid: 'member-uid' }],
  ['userUid', { companyId: 'company-a', userUid: 'another-member-uid' }],
]) {
  test(`acceptCompanyInvitation rejects an existing membership with mismatched ${name}`, async (t) => {
    const token = `mismatch-${name}`;
    const invitationId = `mismatch-${name}`;
    const invitationKey = `companyInvitations/${invitationId}`;
    const membershipKey = 'companyMembers/company-a_member-uid';
    const initialInvitation = {
      companyId: 'company-a', userEmail: 'member@gemailla.test', role: 'viewer', status: 'pending',
      tokenHash: hashInviteToken(token), expiresAt: '2999-01-01T00:00:00.000Z', invitedByUid: 'admin-uid',
    };
    const initialMembership = {
      ...identity, role: 'viewer', status: 'active', createdAt: '2025-01-01T00:00:00.000Z',
    };
    const store = mockAdmin(t, { [invitationKey]: initialInvitation, [membershipKey]: initialMembership });
    const response = res();
    await acceptCompanyInvitationHandler(req({
      uid: 'member-uid', email: 'member@gemailla.test', body: { invitationId, token },
    }), response);
    assert.equal(response.statusCode, 409);
    assert.deepEqual(store.get(membershipKey), initialMembership);
    assert.deepEqual(store.get(invitationKey), initialInvitation);
  });
}

test('acceptCompanyInvitation rolls back membership changes when invitation update fails', async (t) => {
  const token = 'rollback-token';
  const invitationKey = 'companyInvitations/rollback';
  const membershipKey = 'companyMembers/company-a_member-uid';
  const initialInvitation = {
    companyId: 'company-a', userEmail: 'member@gemailla.test', role: 'viewer', status: 'pending',
    tokenHash: hashInviteToken(token), expiresAt: '2999-01-01T00:00:00.000Z', invitedByUid: 'admin-uid',
  };
  const initialMembership = {
    companyId: 'company-a', userUid: 'member-uid', role: 'viewer', status: 'pending',
    createdAt: '2025-01-01T00:00:00.000Z',
  };
  const store = mockAdmin(t, {
    [invitationKey]: initialInvitation, [membershipKey]: initialMembership,
  }, { failOnUpdateKey: invitationKey });
  const response = res();
  await acceptCompanyInvitationHandler(req({
    uid: 'member-uid', email: 'member@gemailla.test', body: { invitationId: 'rollback', token },
  }), response);
  assert.equal(response.statusCode, 500);
  assert.deepEqual(store.get(membershipKey), initialMembership);
  assert.deepEqual(store.get(invitationKey), initialInvitation);
});
