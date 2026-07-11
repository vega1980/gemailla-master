import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const FIRESTORE_RULES_PATH = new URL('../../firestore.rules', import.meta.url);
const STORAGE_RULES_PATH = new URL('../../storage.rules', import.meta.url);

const mutableTenantClaimPatterns = [
  /request\.auth\.token\.companyId/,
  /request\.auth\.token\.companyRole/,
  /request\.auth\.token\.membershipStatus/,
  /request\.auth\.token\.get\('companyId'/,
  /request\.auth\.token\.get\('companyRole'/,
  /request\.auth\.token\.get\('role'/,
  /request\.auth\.token\.get\('membershipStatus'/,
];

describe('multi-tenant rules authorization source', () => {
  it('does not authorize Firestore tenant access from mutable tenant custom claims', async () => {
    const source = await readFile(FIRESTORE_RULES_PATH, 'utf8');

    for (const pattern of mutableTenantClaimPatterns) {
      assert.doesNotMatch(source, pattern);
    }

    assert.match(source, /function membershipPath\(companyId\)/);
    assert.match(source, /\/documents\/companyMembers\/\$\(membershipId\(companyId\)\)/);
    assert.match(source, /function isActiveMember\(companyId\)/);
    assert.match(source, /membershipData\(companyId\)\.get\('status', null\) == 'active'/);
  });

  it('does not authorize Storage tenant access from mutable tenant custom claims', async () => {
    const source = await readFile(STORAGE_RULES_PATH, 'utf8');

    for (const pattern of mutableTenantClaimPatterns) {
      assert.doesNotMatch(source, pattern);
    }

    assert.match(source, /function activeMembership\(companyId\)/);
    assert.match(source, /\/documents\/companyMembers\/\$\(memberId\)/);
    assert.match(source, /member\.data\.status == 'active'/);
    assert.match(source, /function activeCompanyAccess\(companyId\)/);
    assert.match(source, /return activeMembership\(companyId\)/);
  });
});
