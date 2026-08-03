const assert = require('node:assert/strict');
const test = require('node:test');

const {
  isMembershipCreation,
  revokeMembershipUserRefreshTokens,
} = require('../handlers/companyMembershipClaimsHandler');

function snapshot(data, exists = data !== undefined) {
  return { exists, data: () => data };
}

function event(before, after) {
  return {
    params: { memberId: 'company-a_user-a' },
    data: {
      before: snapshot(before),
      after: snapshot(after),
    },
  };
}

test('membership creation does not revoke the new active session', async () => {
  let revokeCalls = 0;
  const result = await revokeMembershipUserRefreshTokens(event(undefined, {
    companyId: 'company-a',
    userUid: 'user-a',
    role: 'owner',
    status: 'active',
  }), {
    auth: { async revokeRefreshTokens() { revokeCalls += 1; } },
  });

  assert.deepEqual(result, { revoked: false, reason: 'membership_created' });
  assert.equal(revokeCalls, 0);
});

test('membership status change revokes the existing session', async () => {
  const revokedUids = [];
  const result = await revokeMembershipUserRefreshTokens(event({
    companyId: 'company-a',
    userUid: 'user-a',
    role: 'owner',
    status: 'active',
  }, {
    companyId: 'company-a',
    userUid: 'user-a',
    role: 'owner',
    status: 'archived',
  }), {
    auth: { async revokeRefreshTokens(uid) { revokedUids.push(uid); } },
  });

  assert.deepEqual(result, { revoked: true, uid: 'user-a' });
  assert.deepEqual(revokedUids, ['user-a']);
});

test('membership deletion revokes the previous user session', async () => {
  const revokedUids = [];
  const result = await revokeMembershipUserRefreshTokens(event({
    companyId: 'company-a',
    userUid: 'user-a',
    role: 'viewer',
    status: 'active',
  }, undefined), {
    auth: { async revokeRefreshTokens(uid) { revokedUids.push(uid); } },
  });

  assert.deepEqual(result, { revoked: true, uid: 'user-a' });
  assert.deepEqual(revokedUids, ['user-a']);
});

test('isMembershipCreation uses Firestore snapshot existence', () => {
  assert.equal(isMembershipCreation(event(undefined, { userUid: 'user-a' })), true);
  assert.equal(isMembershipCreation(event({ userUid: 'user-a' }, { userUid: 'user-a' })), false);
});
