const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');

function loadAdapter({ googleGenAIExport }) {
  const originalLoad = Module._load;
  const modulePath = require.resolve('../handlers/geminiVertexAdapter');

  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === '@google/genai') return googleGenAIExport;
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    delete require.cache[modulePath];
    return require(modulePath);
  } finally {
    Module._load = originalLoad;
  }
}

function createGoogleGenAIMock({ onConstruct, onGenerateContent }) {
  return {
    GoogleGenAI: class GoogleGenAI {
      constructor(options) {
        if (onConstruct) onConstruct(options);
        this.models = {
          generateContent: async (params) => onGenerateContent(params),
        };
      }
    },
  };
}

test('geminiVertexAdapter inicializa Vertex AI sin apiKey y usa project, location y apiVersion', async () => {
  let receivedOptions;
  let receivedParams;
  const { callGeminiVertexAdapter } = loadAdapter({
    googleGenAIExport: createGoogleGenAIMock({
      onConstruct: (options) => {
        receivedOptions = options;
      },
      onGenerateContent: async (params) => {
        receivedParams = params;
        return {
          text: '{"ok":true}',
          usageMetadata: {
            promptTokenCount: 11,
            candidatesTokenCount: 7,
            totalTokenCount: 18,
            cachedContentTokenCount: 2,
            thoughtsTokenCount: 1,
            toolUsePromptTokenCount: 3,
          },
          candidates: [{ finishReason: 'STOP' }],
        };
      },
    }),
  });

  const result = await callGeminiVertexAdapter({
    prompt: 'Analiza',
    documentContext: 'Documento validado',
    model: 'gemini-2.5-pro',
    responseJsonSchema: { type: 'object' },
    correlationId: 'corr-1',
    providerConfiguration: {
      project: 'test-project',
      location: 'global',
      apiVersion: 'v1',
      timeoutMs: 1234,
    },
  });

  assert.deepEqual(receivedOptions, {
    vertexai: true,
    project: 'test-project',
    location: 'global',
    apiVersion: 'v1',
  });
  assert.equal(Object.prototype.hasOwnProperty.call(receivedOptions, 'apiKey'), false);
  assert.equal(receivedParams.model, 'gemini-2.5-pro');
  assert.equal(receivedParams.config.httpOptions.timeout, 1234);
  assert.equal(receivedParams.config.responseMimeType, 'application/json');
  assert.deepEqual(receivedParams.config.responseJsonSchema, { type: 'object' });
  assert.equal(result.outputText, '{"ok":true}');
  assert.equal(result.provider, 'vertex-gemini');
  assert.equal(result.model, 'gemini-2.5-pro');
  assert.equal(result.finishReason, 'STOP');
  assert.equal(result.usageAvailable, true);
  assert.deepEqual(result.usage, {
    input_tokens: 11,
    output_tokens: 7,
    total_tokens: 18,
    cached_input_tokens: 2,
    reasoning_tokens: 1,
    tool_use_prompt_tokens: 3,
  });
});

test('geminiVertexAdapter devuelve usageAvailable=false cuando falta usageMetadata y no inventa tokens', async () => {
  const { callGeminiVertexAdapter } = loadAdapter({
    googleGenAIExport: createGoogleGenAIMock({
      onGenerateContent: async () => ({
        text: 'respuesta libre',
        candidates: [{ finishReason: 'STOP' }],
      }),
    }),
  });

  const result = await callGeminiVertexAdapter({
    prompt: 'Hola',
    model: 'gemini-2.5-pro',
    correlationId: 'corr-2',
    providerConfiguration: {
      project: 'test-project',
      location: 'global',
      apiVersion: 'v1',
    },
  });

  assert.equal(result.outputText, 'respuesta libre');
  assert.equal(result.usageAvailable, false);
  assert.deepEqual(result.usage, {});
});

test('geminiVertexAdapter devuelve error seguro especifico cuando Vertex bloquea la respuesta', async () => {
  const { callGeminiVertexAdapter } = loadAdapter({
    googleGenAIExport: createGoogleGenAIMock({
      onGenerateContent: async () => ({
        text: '',
        promptFeedback: { blockReason: 'SAFETY' },
      }),
    }),
  });
  await assert.rejects(
    () => callGeminiVertexAdapter({
      prompt: 'Hola',
      model: 'gemini-2.5-pro',
      correlationId: 'corr-3',
      providerConfiguration: { project: 'test-project', location: 'global', apiVersion: 'v1' },
    }),
    (error) => {
      assert.equal(error.status, 502);
      assert.equal(error.message, 'Vertex AI bloqueo la solicitud o la respuesta del modelo.');
      return true;
    },
  );
});

test('geminiVertexAdapter devuelve error seguro especifico cuando Vertex no devuelve texto utilizable', async () => {
  const { callGeminiVertexAdapter } = loadAdapter({
    googleGenAIExport: createGoogleGenAIMock({
      onGenerateContent: async () => ({
        text: '   ',
        candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '' }] } }],
      }),
    }),
  });
  await assert.rejects(
    () => callGeminiVertexAdapter({
      prompt: 'Hola',
      model: 'gemini-2.5-pro',
      correlationId: 'corr-4',
      providerConfiguration: { project: 'test-project', location: 'global', apiVersion: 'v1' },
    }),
    (error) => {
      assert.equal(error.status, 502);
      assert.equal(error.message, 'Vertex AI no devolvio texto utilizable.');
      return true;
    },
  );
});

test('geminiVertexAdapter devuelve error seguro especifico cuando Vertex excede el timeout', async () => {
  const { callGeminiVertexAdapter } = loadAdapter({
    googleGenAIExport: createGoogleGenAIMock({
      onGenerateContent: async () => {
        const error = new Error('deadline exceeded');
        error.name = 'AbortError';
        throw error;
      },
    }),
  });
  await assert.rejects(
    () => callGeminiVertexAdapter({
      prompt: 'Hola',
      model: 'gemini-2.5-pro',
      correlationId: 'corr-5',
      providerConfiguration: { project: 'test-project', location: 'global', apiVersion: 'v1' },
    }),
    (error) => {
      assert.equal(error.status, 504);
      assert.equal(error.message, 'Vertex AI excedio el tiempo limite configurado.');
      return true;
    },
  );
});

test('geminiVertexAdapter maneja ADC ausente, project/location ausentes, modelo no disponible y errores internos seguros', async () => {
  const configAdapter = loadAdapter({
    googleGenAIExport: createGoogleGenAIMock({
      onGenerateContent: async () => ({ text: 'ok' }),
    }),
  });

  await assert.rejects(
    () => configAdapter.callGeminiVertexAdapter({
      prompt: 'Hola',
      model: 'gemini-2.5-pro',
      correlationId: 'corr-6',
      providerConfiguration: { project: '', location: '', apiVersion: 'v1' },
    }),
    (error) => {
      assert.equal(error.status, 503);
      assert.match(error.message, /project y location/i);
      return true;
    },
  );

  const adcAdapter = loadAdapter({
    googleGenAIExport: createGoogleGenAIMock({
      onGenerateContent: async () => {
        throw new Error('Could not load the default credentials');
      },
    }),
  });
  await assert.rejects(
    () => adcAdapter.callGeminiVertexAdapter({
      prompt: 'Hola',
      model: 'gemini-2.5-pro',
      correlationId: 'corr-7',
      providerConfiguration: { project: 'test-project', location: 'global', apiVersion: 'v1' },
    }),
    (error) => {
      assert.equal(error.status, 503);
      assert.match(error.message, /credenciales adc/i);
      return true;
    },
  );

  const modelAdapter = loadAdapter({
    googleGenAIExport: createGoogleGenAIMock({
      onGenerateContent: async () => {
        const error = new Error('publisher model not found');
        error.status = 404;
        throw error;
      },
    }),
  });
  await assert.rejects(
    () => modelAdapter.callGeminiVertexAdapter({
      prompt: 'Hola',
      model: 'gemini-2.5-pro',
      correlationId: 'corr-8',
      providerConfiguration: { project: 'test-project', location: 'global', apiVersion: 'v1' },
    }),
    (error) => {
      assert.equal(error.status, 503);
      assert.match(error.message, /modelo configurado/i);
      return true;
    },
  );

  const genericAdapter = loadAdapter({
    googleGenAIExport: createGoogleGenAIMock({
      onGenerateContent: async () => {
        throw new Error('upstream raw detail');
      },
    }),
  });
  await assert.rejects(
    () => genericAdapter.callGeminiVertexAdapter({
      prompt: 'Hola',
      model: 'gemini-2.5-pro',
      correlationId: 'corr-9',
      providerConfiguration: { project: 'test-project', location: 'global', apiVersion: 'v1' },
    }),
    (error) => {
      assert.equal(error.status, 502);
      assert.equal(error.message, 'No se pudo completar la solicitud con Vertex AI.');
      return true;
    },
  );
});
