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
  it('C1: owned-or-company records support explicit tenant scope or unchanged personal owner scope', async () => {
    const src = await readFile(RULES, 'utf8');
    const companyScopeValid = extractFunction(src, 'companyScopeValid');
    const personalScopeValid = extractFunction(src, 'personalScopeValid');
    const personalScopeUnchanged = extractFunction(src, 'personalScopeUnchanged');
    const createOwnedOrCompany = extractFunction(src, 'canCreateOwnedOrCompanyRecord');
    const readOwnedOrCompany = extractFunction(src, 'canReadOwnedOrCompanyRecord');
    const updateOwnedOrCompany = extractFunction(src, 'canUpdateOwnedOrCompanyRecord');

    assert.match(companyScopeValid, /hasCompanyId\(data\)\s*&&\s*canWriteCompany\(data\.companyId\)/);
    assert.match(personalScopeValid, /!hasCompanyId\(data\)\s*&&\s*hasOwnerUid\(data\)/);
    assert.match(personalScopeUnchanged, /!hasCompanyId\(resource\.data\)[\s\S]*!hasCompanyId\(request\.resource\.data\)[\s\S]*hasOwnerUid\(resource\.data\)[\s\S]*hasOwnerUid\(request\.resource\.data\)/);
    assert.match(createOwnedOrCompany, /companyScopeValid\(request\.resource\.data\)[\s\S]*personalScopeValid\(request\.resource\.data\)/);
    assert.match(readOwnedOrCompany, /hasCompanyId\(resource\.data\)[\s\S]*canReadCompany\(resource\.data\.companyId\)[\s\S]*personalScopeValid\(resource\.data\)/);
    assert.match(updateOwnedOrCompany, /companyIdUnchanged\(\)[\s\S]*companyScopeValid\(request\.resource\.data\)[\s\S]*personalScopeUnchanged\(\)/);
  });

  it('D1: validDocumentEnvelope is complete and not truncated', async () => {
    const src = await readFile(RULES, 'utf8');
    const validDocumentEnvelope = extractFunction(src, 'validDocumentEnvelope');

    assert.match(validDocumentEnvelope, /data\.fileSize is number[\s\S]*data\.fileSize <= 15 \* 1024 \* 1024[\s\S]*data\.contentType is string/);
    assert.match(validDocumentEnvelope, /hasNoPublicDocumentUrls\(data\);\s*\}/);
    assert.doesNotMatch(src, /&&\s*d\s*(?:$|\n)/);
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
