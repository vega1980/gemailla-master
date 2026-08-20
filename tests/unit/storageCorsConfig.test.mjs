import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

const require = createRequire(import.meta.url);
const { DEFAULT_ALLOWED_ORIGINS } = require('../../functions/policies/httpPolicy.js');
const corsConfig = JSON.parse(await readFile(new URL('../../storage.cors.json', import.meta.url), 'utf8'));

describe('Cloud Storage CORS configuration', () => {
  it('usa la misma lista cerrada de dominios oficiales que Functions', () => {
    assert.equal(corsConfig.length, 1);
    assert.deepEqual(corsConfig[0].origin, [...DEFAULT_ALLOWED_ORIGINS]);
    assert.equal(corsConfig[0].origin.includes('*'), false);
    assert.equal(new Set(corsConfig[0].origin).size, corsConfig[0].origin.length);
  });

  it('solo habilita GET para descargar objetos privados', () => {
    assert.deepEqual(corsConfig[0].method, ['GET']);
    assert.equal(corsConfig[0].method.includes('*'), false);
  });
});
