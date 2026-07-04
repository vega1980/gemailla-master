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
  it('C1: companyScopeValid exists and is enforced for owned-or-company create/update', async () => {
    const src = await readFile(RULES, 'utf8');
    const companyScopeValid = extractFunction(src, 'companyScopeValid');
    const createOwnedOrCompany = extractFunction(src, 'canCreateOwnedOrCompanyRecord');
    const updateOwnedOrCompany = extractFunction(src, 'canUpdateOwnedOrCompanyRecord');

    assert.match(companyScopeValid, /!hasCompanyId\(data\)\s*\|\|\s*canWriteCompany\(data\.companyId\)/);
    assert.match(createOwnedOrCompany, /companyScopeValid\(request\.resource\.data\)/);
    assert.match(updateOwnedOrCompany, /companyScopeValid\(request\.resource\.data\)/);
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
