import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const RULES = new URL('../../firestore.rules', import.meta.url);

function extractFunction(src, name) {
  const pattern = new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n    \\}`);
  const match = src.match(pattern);
  assert.ok(match, `Expected to find function ${name}`);
  return match[0];
}

function extractMatchBlock(src, path) {
  const pattern = new RegExp(`match\\s+/${path}\\s*\\{[\\s\\S]*?\\n    \\}`);
  const match = src.match(pattern);
  assert.ok(match, `Expected to find match /${path}`);
  return match[0];
}

describe('firestore.rules static security invariants', () => {
  it('C1: companyScopeValid requires an explicit writable companyId for owned-or-company create/update', async () => {
    const src = await readFile(RULES, 'utf8');
    const companyScopeValid = extractFunction(src, 'companyScopeValid');
    const createOwnedOrCompany = extractFunction(src, 'canCreateOwnedOrCompanyRecord');
    const readOwnedOrCompany = extractFunction(src, 'canReadOwnedOrCompanyRecord');
    const updateOwnedOrCompany = extractFunction(src, 'canUpdateOwnedOrCompanyRecord');

    assert.match(companyScopeValid, /hasCompanyId\(data\)\s*&&\s*canWriteCompany\(data\.companyId\)/);
    assert.doesNotMatch(companyScopeValid, /!hasCompanyId\(data\)/);
    assert.match(createOwnedOrCompany, /companyScopeValid\(request\.resource\.data\)/);
    assert.match(readOwnedOrCompany, /hasCompanyId\(resource\.data\)[\s\S]*canReadCompany\(resource\.data\.companyId\)/);
    assert.match(updateOwnedOrCompany, /companyIdUnchanged\(\)[\s\S]*companyScopeValid\(request\.resource\.data\)/);
  });

  it('C2: company access requires active membership and allowed roles, with default deny fallback', async () => {
    const src = await readFile(RULES, 'utf8');
    const canReadCompany = extractFunction(src, 'canReadCompany');
    const canWriteCompany = extractFunction(src, 'canWriteCompany');
    const canManageCompany = extractFunction(src, 'canManageCompany');

    assert.match(canReadCompany, /sameCompany\(companyId\)[\s\S]*hasAnyCompanyRole\(companyId, \['owner', 'director', 'admin', 'editor', 'viewer', 'invitado'\]\)/);
    assert.match(canWriteCompany, /sameCompany\(companyId\)[\s\S]*hasAnyCompanyRole\(companyId, \['owner', 'director', 'admin', 'editor'\]\)/);
    assert.match(canManageCompany, /sameCompany\(companyId\)[\s\S]*hasAnyCompanyRole\(companyId, \['owner', 'director', 'admin'\]\)/);
    assert.match(src, /match\s+\/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/);
    assert.doesNotMatch(src, /allow\s+(read|write|create|update|delete|list|get)(?:\s*,\s*(?:read|write|create|update|delete|list|get))*\s*:\s*if\s+true\s*;/);
  });

  it('A1: non-owner company managers cannot assign owner or director roles', async () => {
    const src = await readFile(RULES, 'utf8');
    const assignableRoles = extractFunction(src, 'assignableRoles');
    const companyMembers = extractMatchBlock(src, 'companyMembers/\\{memberId\\}');

    assert.match(assignableRoles, /isCompanyOwner\(companyId\)/);
    assert.match(assignableRoles, /\?\s*\['owner',\s*'director',\s*'admin',\s*'editor',\s*'viewer',\s*'invitado'\]/);
    assert.match(assignableRoles, /:\s*\['admin',\s*'editor',\s*'viewer',\s*'invitado'\]/);
    assert.doesNotMatch(assignableRoles, /:\s*\[[^\]]*'owner'/);
    assert.doesNotMatch(assignableRoles, /:\s*\[[^\]]*'director'/);

    assert.match(companyMembers, /request\.resource\.data\.get\('role',\s*null\)\s+in\s+assignableRoles\(request\.resource\.data\.companyId\)/);
    assert.match(companyMembers, /request\.resource\.data\.get\('role',\s*null\)\s+in\s+assignableRoles\(resource\.data\.companyId\)/);
  });
});
