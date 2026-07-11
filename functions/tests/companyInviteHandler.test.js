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

function mockAdmin(t, initial = {}) {
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
      return callback({
        async get(ref) { return new Snap(ref.id, store.get(ref.key)); },
        set(ref, value) { store.set(ref.key, { ...value }); },
        update(ref, value) { store.set(ref.key, { ...(store.get(ref.key) || {}), ...value }); },
      });
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
