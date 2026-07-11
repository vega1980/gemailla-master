import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const STORAGE_RULES_PATH = new URL('../../storage.rules', import.meta.url);

function includesWriterRoles(source) {
  for (const role of ['owner', 'director', 'admin', 'editor']) {
    assert.match(source, new RegExp(`'${role}'`));
  }
}

describe('Cloud Storage rules static invariants', () => {
  it('requires an active Firestore membership before granting company object access', async () => {
    const source = await readFile(STORAGE_RULES_PATH, 'utf8');

    assert.doesNotMatch(source, /request\.auth\.token\.companyId/);
    assert.doesNotMatch(source, /request\.auth\.token\.membershipStatus/);

    assert.match(source, /function membershipId\(companyId\)/);
    assert.match(source, /function activeMembership\(companyId\)/);
    assert.match(source, /\/documents\/companyMembers\/\$\(memberId\)/);

    assert.match(source, /\.data\.companyId\s*==\s*companyId|member\.companyId\s*==\s*companyId/);
    assert.match(source, /\.data\.userUid\s*==\s*request\.auth\.uid|member\.userUid\s*==\s*request\.auth\.uid/);
    assert.match(source, /\.data\.status\s*==\s*'active'|member\.status\s*==\s*'active'/);

    assert.match(source, /function activeCompanyAccess\(companyId\)/);
    assert.match(source, /return activeMembership\(companyId\)/);
    assert.match(source, /allow read: if activeCompanyAccess\(companyId\)/);
  });

  it('restricts uploads to active writer roles with matching metadata and backing document', async () => {
    const source = await readFile(STORAGE_RULES_PATH, 'utf8');

    assert.match(source, /function canWriteCompanyDocuments\(companyId\)/);
    includesWriterRoles(source);

    assert.doesNotMatch(source, /request\.auth\.token\.companyRole/);
    assert.match(source, /activeMembershipRole\(companyId\)\s+in\s+\[|isWriterRole\(activeMembershipRole\(companyId\)\)/);

    assert.match(source, /function documentExists\(companyId, documentId\)/);
    assert.match(source, /\/documents\/documents\/\$\(documentId\)/);
    assert.match(source, /\.data\.companyId\s*==\s*companyId/);

    assert.match(source, /function isValidMetadata\(companyId, documentId\)/);
    assert.match(source, /request\.resource\.metadata/);
    assert.match(source, /companyId', 'documentId/);
    assert.match(source, /md\.companyId\s*==\s*companyId/);
    assert.match(source, /md\.documentId\s*==\s*documentId/);

    assert.match(source, /allow create: if/);
    assert.match(source, /canWriteCompanyDocuments\(companyId\)/);
    assert.match(source, /documentExists\(companyId, documentId\)/);
    assert.match(source, /isValidMetadata\(companyId, documentId\)/);
    assert.match(source, /request\.resource\.size\s*>\s*0/);
    assert.match(source, /request\.resource\.size\s*<\s*15 \* 1024 \* 1024/);
    assert.match(source, /allow update, delete: if false/);
    assert.doesNotMatch(source, /request\.resource\.customMetadata/);
  });

  it('keeps uploads limited to PDF or XML files up to 15 MB', async () => {
    const source = await readFile(STORAGE_RULES_PATH, 'utf8');

    assert.match(source, /application\/pdf/);
    assert.match(source, /text\/xml/);
    assert.match(source, /application\/xml/);
    assert.match(source, /request\.resource\.size\s*<\s*15 \* 1024 \* 1024/);
    assert.match(source, /contentTypeMatchesExtension\(fileName\)|hasAllowedDocumentContentType\(\)/);
  });
});
