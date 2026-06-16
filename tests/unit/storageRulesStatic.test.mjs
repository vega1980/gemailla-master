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

  it('enforces tenant isolation through the company custom claim and upload metadata', async () => {
    const source = await readFile(STORAGE_RULES_PATH, 'utf8');

    assert.match(source, /request\.auth\.token\.companyId == companyId/);
    assert.match(source, /request\.resource\.metadata\.companyId == companyId/);
    assert.match(source, /allow create: if hasCompanyToken\(companyId\)/);
    assert.match(source, /&& isValidMetadata\(companyId\)/);
    assert.doesNotMatch(source, /request\.auth\.token\.companyRole/);
    assert.doesNotMatch(source, /request\.resource\.metadata\.documentId == documentId/);
    assert.match(source, /allow update, delete: if false/);
  });
});
