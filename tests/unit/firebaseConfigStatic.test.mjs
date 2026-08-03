import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const FIREBASE_JSON = new URL('../../firebase.json', import.meta.url);
const FIREBASERC = new URL('../../.firebaserc', import.meta.url);
const FIRESTORE_INDEXES = new URL('../../firestore.indexes.json', import.meta.url);

async function readJson(url) {
  return JSON.parse(await readFile(url, 'utf8'));
}

describe('Firebase project and deploy configuration invariants', () => {
  it('keeps the required Firebase project aliases', async () => {
    const config = await readJson(FIREBASERC);

    assert.equal(config.projects.default, 'gemailla-enterprise');
    if (config.projects.staging !== undefined) {
      assert.equal(config.projects.staging, 'gemailla-enterprise-staging');
    }
  });

  it('publishes Hosting from dist and routes API rewrites to the expected functions', async () => {
    const config = await readJson(FIREBASE_JSON);

    assert.equal(config.hosting.public, 'dist');
    assert.ok(
      config.hosting.rewrites.some((rewrite) => rewrite.source === '/api/ai' && rewrite.function === 'ai'),
      'Expected /api/ai to route to the ai function',
    );
    assert.ok(
      config.hosting.rewrites.some((rewrite) => rewrite.source === '/api/functions/**' && rewrite.function === 'functionsRouter'),
      'Expected /api/functions/** to route to functionsRouter',
    );
  });

  it('declares required Firestore and Storage rules plus Firestore indexes files', async () => {
    const config = await readJson(FIREBASE_JSON);
    const indexes = await readJson(FIRESTORE_INDEXES);

    assert.equal(config.firestore.rules, 'firestore.rules');
    assert.equal(config.firestore.indexes, 'firestore.indexes.json');
    assert.equal(config.storage.rules, 'storage.rules');
    assert.ok(Array.isArray(indexes.indexes));
    assert.ok(Array.isArray(indexes.fieldOverrides));
  });

  it('declares every Firebase service used by local workflows on loopback addresses', async () => {
    const config = await readJson(FIREBASE_JSON);

    assert.deepEqual(config.emulators.auth, { port: 9099, host: '127.0.0.1' });
    assert.deepEqual(config.emulators.firestore, { port: 8080, host: '127.0.0.1' });
    assert.deepEqual(config.emulators.storage, { port: 9199, host: '127.0.0.1' });
    assert.deepEqual(config.emulators.functions, { port: 5001, host: '127.0.0.1' });
    assert.deepEqual(config.emulators.hosting, { port: 5000, host: '127.0.0.1' });
  });

  it('keeps manual and E2E emulator workflows demo-only and complete', async () => {
    const packageJson = await readJson(new URL('../../package.json', import.meta.url));
    const expectedOnly = /--only auth,firestore,storage,functions,hosting/;

    assert.match(packageJson.scripts['emulators:start'], expectedOnly);
    assert.match(packageJson.scripts['emulators:start'], /--project demo-gemailla-local/);
    assert.match(packageJson.scripts['test:e2e:emulators'], expectedOnly);
    assert.match(packageJson.scripts['test:e2e:emulators'], /--project demo-gemailla-e2e/);
    assert.match(packageJson.scripts['test:e2e:emulators'], /PLAYWRIGHT_BASE_URL=http:\/\/127\.0\.0\.1:5000/);
    assert.match(packageJson.scripts['build:emulators'], /VITE_FIREBASE_PROJECT_ID=demo-gemailla-e2e/);
    assert.match(packageJson.scripts['emulators:start'], /CLOUDSDK_CONFIG=\/tmp\/gemailla-emulator-cloudsdk/);
    assert.match(packageJson.scripts['test:e2e:emulators'], /CLOUDSDK_CONFIG=\/tmp\/gemailla-emulator-cloudsdk/);
    assert.match(packageJson.scripts['emulators:start'], /VERTEX_GEMINI_PROJECT=demo-gemailla-local/);
    assert.match(packageJson.scripts['test:e2e:emulators'], /VERTEX_GEMINI_PROJECT=demo-gemailla-e2e/);
  });
});
