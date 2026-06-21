import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const source = await readFile(new URL('../../src/api/firebaseClient.js', import.meta.url), 'utf8');

describe('fachada pública firebaseClient', () => {
  it('centraliza la validación same-origin de endpoints internos antes de enviar Authorization', () => {
    assert.match(source, /function getSafeInternalEndpoint\(/);
    assert.match(source, /url\.origin !== window\.location\.origin/);
    assert.match(source, /url\.username \|\| url\.password/);
    assert.match(source, /!url\.pathname\.startsWith\('\/api\/'\)/);
    assert.doesNotMatch(source, /const endpoint = import\.meta\.env\.VITE_LLM_ENDPOINT \|\| '\/api\/ai';/);
  });

  it('reutiliza la validación para funciones compatibles y evita interpolar nombres sin codificar', () => {
    assert.match(source, /function getSafeFunctionsEndpoint\(\)/);
    assert.match(source, /getSafeInternalEndpoint\(configured, '\/api\/functions', 'funciones'\)/);
    assert.match(source, /const endpoint = getSafeFunctionsEndpoint\(\);/);
    assert.match(source, /const safeFunctionName = encodeURIComponent\(String\(name \|\| ''\)\.trim\(\)\);/);
    assert.match(source, /fetch\(`.*safeFunctionName.*`/);
  });
});
