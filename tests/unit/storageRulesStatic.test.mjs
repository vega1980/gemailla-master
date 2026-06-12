import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const STORAGE_RULES_PATH = new URL('../../storage.rules', import.meta.url);

describe('Cloud Storage rules static invariants', () => {
  it('uses the literal default Firestore database in cross-service checks', async () => {
    const source = await readFile(STORAGE_RULES_PATH, 'utf8');

    assert.match(source, /firestore\.exists\(\/databases\/\(default\)\/documents\/companies\/\$\(companyId\)\)/);
    assert.match(source, /return \/databases\/\(default\)\/documents\/documents\/\$\(documentId\);/);
    assert.doesNotMatch(source, /\$\(database\)/);
    assert.doesNotMatch(source, /\{database\}/);
  });
});
