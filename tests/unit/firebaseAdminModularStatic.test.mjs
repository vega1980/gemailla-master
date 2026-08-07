import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const adminAdapterUrl = new URL('../../functions/firebaseAdmin.js', import.meta.url);
const e2eHarnessUrl = new URL('../e2e/support/firebaseHarness.js', import.meta.url);

test('Firebase Admin 14 usa únicamente sus entradas modulares', async () => {
  const [adminAdapter, e2eHarness] = await Promise.all([
    readFile(adminAdapterUrl, 'utf8'),
    readFile(e2eHarnessUrl, 'utf8'),
  ]);

  assert.match(adminAdapter, /require\('firebase-admin\/app'\)/);
  assert.match(adminAdapter, /require\('firebase-admin\/auth'\)/);
  assert.match(adminAdapter, /require\('firebase-admin\/firestore'\)/);
  assert.match(adminAdapter, /require\('firebase-admin\/storage'\)/);
  assert.match(e2eHarness, /requireFromFunctions\('firebase-admin\/app'\)/);
  assert.match(e2eHarness, /requireFromFunctions\('firebase-admin\/auth'\)/);
  assert.doesNotMatch(e2eHarness, /requireFromFunctions\('firebase-admin'\)/);
});
