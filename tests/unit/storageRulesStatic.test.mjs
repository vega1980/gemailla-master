import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const STORAGE_RULES_PATH = new URL('../../storage.rules', import.meta.url);

describe('Cloud Storage rules static invariants', () => {
  it('requires an active tenant token before granting company object access', async () => {
    const source = await readFile(STORAGE_RULES_PATH, 'utf8');

    assert.match(source, /function hasCompanyToken\(companyId\) \{/);
    assert.match(source, /request\.auth\.token\.companyId == companyId/);
    assert.match(source, /request\.auth\.token\.membershipStatus == 'active'/);
    assert.match(source, /allow read: if hasCompanyToken\(companyId\)/);
  });

  it('restricts uploads to active writer roles with matching custom metadata', async () => {
    const source = await readFile(STORAGE_RULES_PATH, 'utf8');

    assert.match(source, /function canWriteCompanyDocuments\(companyId\) \{/);
    assert.match(source, /request\.auth\.token\.companyRole in \['owner', 'director', 'admin', 'editor'\]/);
    assert.match(source, /allow create: if canWriteCompanyDocuments\(companyId\)/);
    assert.match(source, /request\.resource\.metadata\.companyId == companyId/);
    assert.match(source, /request\.resource\.metadata\.documentId == documentId/);
    assert.match(source, /request\.resource\.size < 15 \* 1024 \* 1024/);
    assert.match(source, /hasAllowedDocumentContentType\(\)/);
    assert.match(source, /allow update, delete: if false/);
  });
});
