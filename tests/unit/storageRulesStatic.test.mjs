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
  it('requires an active tenant token before granting company object access', async () => {
    const source = await readFile(STORAGE_RULES_PATH, 'utf8');

    assert.match(source, /function hasCompanyToken\(companyId\)/);
    assert.match(source, /request\.auth\.token\.companyId\s*==\s*companyId/);
    assert.match(source, /request\.auth\.token\.membershipStatus\s*==\s*'active'/);

    assert.doesNotMatch(source, /firestore\.get\(/);
    assert.doesNotMatch(source, /companyMembers/);

    assert.match(source, /function activeCompanyAccess\(companyId\)/);
    assert.match(source, /hasCompanyToken\(companyId\)/);
    assert.match(source, /allow read: if activeCompanyAccess\(companyId\)/);
  });

  it('restricts uploads to active writer roles with matching object metadata', async () => {
    const source = await readFile(STORAGE_RULES_PATH, 'utf8');

    assert.match(source, /function canWriteCompanyDocuments\(companyId\)/);
    includesWriterRoles(source);

    assert.match(source, /request\.auth\.token\.companyRole\s+in\s+\[|isWriterRole\(request\.auth\.token\.companyRole\)/);
    assert.doesNotMatch(source, /activeMembershipRole/);
    assert.doesNotMatch(source, /function documentExists/);

    assert.match(source, /function isValidMetadata\(companyId, documentId\)/);
    assert.match(source, /request\.resource\.metadata/);
    assert.match(source, /companyId', 'documentId/);
    assert.match(source, /md\.companyId\s*==\s*companyId/);
    assert.match(source, /md\.documentId\s*==\s*documentId/);

    assert.match(source, /allow create: if/);
    assert.match(source, /canWriteCompanyDocuments\(companyId\)/);
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
