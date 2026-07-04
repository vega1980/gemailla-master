const admin = require('firebase-admin');

const CLAIM_RELEVANT_FIELDS = ['companyId', 'role', 'status', 'userUid'];

function getMembershipUserUid(before = {}, after = {}) {
  return String(after.userUid || before.userUid || '').trim();
}

function didClaimRelevantMembershipChange(before = {}, after = {}) {
  return CLAIM_RELEVANT_FIELDS.some((field) => before[field] !== after[field]);
}

async function revokeMembershipUserRefreshTokens(event = {}) {
  const before = event.data?.before?.data?.() || {};
  const after = event.data?.after?.data?.() || {};

  if (!didClaimRelevantMembershipChange(before, after)) {
    return { revoked: false, reason: 'no_claim_relevant_change' };
  }

  const uid = getMembershipUserUid(before, after);
  if (!uid) {
    console.warn(JSON.stringify({
      eventName: 'membership_claim_revocation_skipped',
      reason: 'missing_user_uid',
      membershipId: event.params?.memberId || null,
    }));
    return { revoked: false, reason: 'missing_user_uid' };
  }

  await admin.auth().revokeRefreshTokens(uid);
  console.log(JSON.stringify({
    eventName: 'membership_refresh_tokens_revoked',
    uid,
    membershipId: event.params?.memberId || null,
    companyId: after.companyId || before.companyId || null,
    previousStatus: before.status || null,
    nextStatus: after.status || null,
    previousRole: before.role || null,
    nextRole: after.role || null,
  }));

  return { revoked: true, uid };
}

module.exports = {
  didClaimRelevantMembershipChange,
  getMembershipUserUid,
  revokeMembershipUserRefreshTokens,
};
