import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const STORAGE_RULES_PATH = new URL('../../storage.rules', import.meta.url);

describe('Cloud Storage rules static invariants', () => {
  it('does not perform Firestore reads from Storage rules', async () => {
    const source = await readFile(STORAGE_RULES_PATH, 'utf8');

    assert.doesNotMatch(source, /firestore\.(exists|get)\(/);
    assert.doesNotMatch(source, /\/databases\//);
    assert.doesNotMatch(source, /\$\(database\)/);
    assert.doesNotMatch(source, /\{database\}/);
  });

  it('enforces tenant isolation through custom claims and object metadata', async () => {
    const source = await readFile(STORAGE_RULES_PATH, 'utf8');

    assert.match(source, /request\.auth\.token\.companyId == companyId/);
    assert.match(source, /request\.auth\.token\.membershipStatus == 'active'/);
    assert.match(source, /request\.auth\.token\.companyRole in \['owner', 'director', 'admin', 'editor'\]/);
    assert.match(source, /request\.resource\.metadata\.companyId == companyId/);
    assert.match(source, /request\.resource\.metadata\.documentId == documentId/);
    assert.match(source, /resource\.metadata\.companyId == companyId/);
    assert.match(source, /resource\.metadata\.documentId == documentId/);
  });
});
