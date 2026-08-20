import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { uniqueId } from '../e2e/support/firebaseHarness.js';

const harnessUrl = new URL('../e2e/support/firebaseHarness.js', import.meta.url);

test('uniqueId conserva el prefijo y usa identificadores criptograficos distintos', async () => {
  const originalRandom = Math.random;
  Math.random = () => {
    throw new Error('uniqueId no debe usar Math.random()');
  };

  try {
    const first = uniqueId('empresa');
    const second = uniqueId('empresa');

    assert.match(first, /^empresa-\d+-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.match(second, /^empresa-\d+-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.notEqual(first, second);
  } finally {
    Math.random = originalRandom;
  }

  const source = await readFile(harnessUrl, 'utf8');
  assert.doesNotMatch(source, /Math\.random\s*\(/);
});
