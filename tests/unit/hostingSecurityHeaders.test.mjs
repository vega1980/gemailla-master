import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

test('producción no impone CSP y permite popups de autenticación', async () => {
  const config = JSON.parse(await readFile(new URL('../../firebase.json', import.meta.url)));
  const headers = config.hosting.headers.flatMap(entry => entry.headers || []);
  assert.equal(headers.some(header => header.key.startsWith('Content-Security-Policy')), false);
  assert.equal(headers.find(header => header.key === 'Cross-Origin-Opener-Policy')?.value, 'same-origin-allow-popups');
});
test('emulador genera CSP report-only compatible con Auth y App Check', async () => {
  const result = spawnSync(process.execPath, ['scripts/prepare-emulator-firebase-config.mjs'], { cwd: new URL('../..', import.meta.url), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const generatedUrl = new URL('../../.firebase.emulator.generated.json', import.meta.url);
  const config = JSON.parse(await readFile(generatedUrl)); await rm(generatedUrl);
  const csp = config.hosting.headers.flatMap(entry => entry.headers || []).find(header => header.key === 'Content-Security-Policy-Report-Only')?.value || '';
  assert.match(csp, /accounts\.google\.com/); assert.match(csp, /recaptcha/); assert.match(csp, /firebaseapp\.com/); assert.match(csp, /googleapis\.com/);
});
