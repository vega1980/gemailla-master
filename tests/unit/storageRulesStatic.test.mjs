import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const STORAGE_RULES_PATH = new URL('../../storage.rules', import.meta.url);

describe('Cloud Storage rules static invariants', () => {
  it('verifies the Firestore document before accepting uploads', async () => {
    const source = await readFile(STORAGE_RULES_PATH, 'utf8');

    assert.match(source, /firestore\.exists\(\/databases\/\(default\)\/documents\/documents\/\$\(documentId\)\)/);
    assert.match(source, /firestore\.get\(\/databases\/\(default\)\/documents\/documents\/\$\(documentId\)\)\.data\.companyId == companyId/);
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
