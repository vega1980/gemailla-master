import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const FIRESTORE_RULES_PATH = new URL('../../firestore.rules', import.meta.url);
const STORAGE_RULES_PATH = new URL('../../storage.rules', import.meta.url);

const mutableTenantRoleClaimPatterns = [
  /request\.auth\.token\.companyRole/,
  /request\.auth\.token\.role/,
  /request\.auth\.token\.membershipStatus/,
  /request\.auth\.token\.get\('companyRole'/,
  /request\.auth\.token\.get\('role'/,
  /request\.auth\.token\.get\('membershipStatus'/,
];

const storageTenantClaimPatterns = [
  /request\.auth\.token\.companyId/,
  /request\.auth\.token\.get\('companyId'/,
  ...mutableTenantRoleClaimPatterns,
];

describe('multi-tenant rules authorization source', () => {
  it('requires Firestore tenant claim consistency and active membership documents', async () => {
    const source = await readFile(FIRESTORE_RULES_PATH, 'utf8');

    for (const pattern of mutableTenantRoleClaimPatterns) {
      assert.doesNotMatch(source, pattern);
    }

    assert.doesNotMatch(source, /function tokenCompanyId\(\)/);
    assert.doesNotMatch(source, /function tokenMatchesCompany\(companyId\)/);
    assert.match(source, /function authCompanyMatches\(companyId\)/);
    assert.match(source, /request\.auth\.token\.companyId is string/);
    assert.match(source, /request\.auth\.token\.companyId == companyId/);
    assert.match(source, /function membershipPath\(companyId\)/);
    assert.match(source, /\/documents\/companyMembers\/\$\(membershipId\(companyId\)\)/);
    assert.match(source, /function isActiveMember\(companyId\)/);
    assert.match(source, /membershipData\(companyId\)\.get\('status', null\) == 'active'/);
    assert.match(source, /function canReadCompany\(companyId\)[\s\S]*authCompanyMatches\(companyId\)[\s\S]*\(isCompanyOwner\(companyId\) \|\| isActiveMember\(companyId\)\)/);
    assert.match(source, /function canWriteCompany\(companyId\)[\s\S]*authCompanyMatches\(companyId\)[\s\S]*hasCompanyRole\(companyId, \['owner', 'director', 'admin', 'editor'\]\)/);
    assert.match(source, /function canManageCompany\(companyId\)[\s\S]*authCompanyMatches\(companyId\)[\s\S]*hasCompanyRole\(companyId, \['owner', 'director', 'admin'\]\)/);
  });

  it('does not authorize Storage tenant access from mutable tenant custom claims', async () => {
    const source = await readFile(STORAGE_RULES_PATH, 'utf8');

    for (const pattern of storageTenantClaimPatterns) {
      assert.doesNotMatch(source, pattern);
    }

    assert.match(source, /function activeMembership\(companyId\)/);
    assert.match(source, /\/documents\/companyMembers\/\$\(memberId\)/);
    assert.match(source, /member\.data\.status == 'active'/);
    assert.match(source, /function activeCompanyAccess\(companyId\)/);
    assert.match(source, /return activeMembership\(companyId\)/);
  });
});
