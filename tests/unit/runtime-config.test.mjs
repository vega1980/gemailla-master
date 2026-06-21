import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyRuntimeConfig, parseRuntimeConfig } from '../../src/config/runtimeConfig.js';

describe('runtime config seguro', () => {
  it('rechaza app-config.js con código no permitido', () => {
    assert.throws(
      () => parseRuntimeConfig('window.location = \"https://evil.example\";'),
      /código no permitido/,
    );
  });

  it('aplica solo llaves permitidas desde JSON', () => {
    const fakeWindow = {};
    const config = parseRuntimeConfig(JSON.stringify({
      GEMAILLA_FIREBASE_CONFIG: { apiKey: ' public ', evil: 'no' },
      GEMAILLA_USE_FIREBASE_EMULATORS: 'auto',
      GEMAILLA_RELEASE: { gitSha: 'abc', token: 'secret' },
    }));

    applyRuntimeConfig(config, fakeWindow);

    assert.deepEqual(fakeWindow.GEMAILLA_FIREBASE_CONFIG, { apiKey: 'public' });
    assert.equal(fakeWindow.GEMAILLA_USE_FIREBASE_EMULATORS, 'auto');
    assert.deepEqual(fakeWindow.GEMAILLA_RELEASE, { gitSha: 'abc' });
  });

  it('parsea asignaciones literales permitidas sin ejecutar el script remoto completo', () => {
    const config = parseRuntimeConfig('window.GEMAILLA_FIREBASE_CONFIG = { apiKey: "public", ignored: "x" };\n\nwindow.GEMAILLA_USE_FIREBASE_EMULATORS = "auto";');

    assert.deepEqual(config.firebaseConfig, { apiKey: 'public' });
    assert.equal(config.useFirebaseEmulators, 'auto');
  });

});
