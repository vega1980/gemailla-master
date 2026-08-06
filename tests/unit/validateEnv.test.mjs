import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  FRONTEND_REQUIRED,
  getFunctionsConfigSource,
  getFunctionsRequiredNames,
  validateEnvironment,
} from '../../scripts/validate-env.js';

describe('validate-env', () => {
  it('exige la clave pública de App Check en el frontend', () => {
    assert.equal(FRONTEND_REQUIRED.includes('VITE_FIREBASE_APPCHECK_SITE_KEY'), true);
  });

  it('usa runtimeConfig/ai cuando no hay configuración Vertex en entorno', () => {
    const env = {};
    assert.equal(getFunctionsConfigSource(env), 'runtimeConfig/ai');
    assert.deepEqual(getFunctionsRequiredNames(env), []);

    const result = validateEnvironment({ target: 'functions', env });
    assert.equal(result.ok, true);
    assert.equal(result.source, 'runtimeConfig/ai');
  });

  it('valida Vertex solo cuando la fuente real es el entorno', () => {
    const env = {
      VERTEX_GEMINI_MODEL: 'gemini-3.6-flash',
      VERTEX_GEMINI_PROJECT: 'test-project',
      VERTEX_GEMINI_LOCATION: 'global',
      VERTEX_GEMINI_INPUT_PER_1K_TOKENS_USD: '0.1',
      VERTEX_GEMINI_CACHED_INPUT_PER_1K_TOKENS_USD: '0.02',
      VERTEX_GEMINI_OUTPUT_PER_1K_TOKENS_USD: '0.4',
      VERTEX_GEMINI_REASONING_TOKEN_TREATMENT: 'billable',
      VERTEX_GEMINI_REASONING_PER_1K_TOKENS_USD: '0.3',
    };

    assert.equal(getFunctionsConfigSource(env), 'env');
    assert.deepEqual(getFunctionsRequiredNames(env), [
      'VERTEX_GEMINI_MODEL',
      'VERTEX_GEMINI_LOCATION',
      'VERTEX_GEMINI_INPUT_PER_1K_TOKENS_USD',
      'VERTEX_GEMINI_CACHED_INPUT_PER_1K_TOKENS_USD',
      'VERTEX_GEMINI_OUTPUT_PER_1K_TOKENS_USD',
      'VERTEX_GEMINI_REASONING_TOKEN_TREATMENT',
      'VERTEX_GEMINI_REASONING_PER_1K_TOKENS_USD',
    ]);

    const result = validateEnvironment({ target: 'functions', env });
    assert.equal(result.ok, true);
    assert.equal(result.source, 'env');
  });

  it('bloquea configuraciones locales activas de OpenAI', () => {
    for (const variableName of ['OPENAI_API_KEY', 'OPENAI_MODEL', 'VITE_OPENAI_API_KEY']) {
      const env = { [variableName]: variableName === 'OPENAI_MODEL' ? 'gpt-4o-mini' : 'test-openai-key' };
      const result = validateEnvironment({ target: 'functions', env });
      assert.equal(result.ok, false);
      assert.equal(result.reason, 'blocked');
      assert.deepEqual(result.blockedLocalVariables, [variableName]);
    }
  });

  it('no exige claves API de Gemini', () => {
    const env = {
      VERTEX_GEMINI_MODEL: 'gemini-3.6-flash',
      GOOGLE_CLOUD_PROJECT: 'test-project',
      VERTEX_GEMINI_LOCATION: 'global',
      VERTEX_GEMINI_INPUT_PER_1K_TOKENS_USD: '0.1',
      VERTEX_GEMINI_CACHED_INPUT_PER_1K_TOKENS_USD: '0.02',
      VERTEX_GEMINI_OUTPUT_PER_1K_TOKENS_USD: '0.4',
      VERTEX_GEMINI_REASONING_TOKEN_TREATMENT: 'ignore',
    };

    const result = validateEnvironment({ target: 'functions', env });
    assert.equal(result.ok, true);
    assert.equal(result.source, 'env');
  });
});
