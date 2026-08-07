import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { describe, it, beforeEach, afterEach } from 'node:test';
import Module from 'node:module';

const realRequire = createRequire(import.meta.url);
const MODULE_PATH = new URL('../../functions/index.js', import.meta.url);
const ORIGINAL_ENV = { ...process.env };

function assertCloseTo(actual, expected, tolerance = 1e-12) {
  assert.ok(Math.abs(actual - expected) < tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);
}

class MockDocSnap {
  constructor(id, data) {
    this.id = id;
    this._data = data;
    this.exists = data !== undefined;
  }

  data() {
    return this._data;
  }
}

class MockQuerySnap {
  constructor(docs) {
    this.docs = docs;
    this.empty = docs.length === 0;
  }
}

function createStore(initial = {}) {
  const store = new Map();
  for (const [collection, docs] of Object.entries(initial)) {
    for (const [id, data] of Object.entries(docs)) {
      store.set(`${collection}/${id}`, structuredClone(data));
    }
  }
  return store;
}

function createFirestore(store) {
  function docRef(collectionName, id) {
    return {
      collectionName,
      id,
      key: `${collectionName}/${id}`,
      async get() {
        return new MockDocSnap(id, store.get(this.key));
      },
      async set(value, options = {}) {
        const previous = options.merge ? (store.get(this.key) || {}) : {};
        store.set(this.key, { ...previous, ...structuredClone(value) });
      },
    };
  }

  function query(collectionName) {
    const filters = [];
    return {
      where(field, op, value) {
        assert.equal(op, '==');
        filters.push({ field, value });
        return this;
      },
      limit() {
        return this;
      },
      async get() {
        const docs = [];
        for (const [key, data] of store.entries()) {
          const [candidateCollection, id] = key.split('/');
          if (candidateCollection !== collectionName) continue;
          if (filters.every(({ field, value }) => data?.[field] === value)) {
            docs.push(new MockDocSnap(id, data));
          }
        }
        return new MockQuerySnap(docs);
      },
    };
  }

  return {
    collection(collectionName) {
      return {
        doc(id) {
          return docRef(collectionName, id);
        },
        where(field, op, value) {
          return query(collectionName).where(field, op, value);
        },
      };
    },
    async runTransaction(callback) {
      return callback({
        async get(ref) {
          return new MockDocSnap(ref.id, store.get(ref.key));
        },
        set(ref, value, options = {}) {
          const previous = options.merge ? (store.get(ref.key) || {}) : {};
          store.set(ref.key, { ...previous, ...structuredClone(value) });
        },
      });
    },
  };
}

function createConfig(overrides = {}) {
  return {
    provider: 'vertex-gemini',
    model: 'gemini-3.6-flash',
    rateLimitWindowMs: 60000,
    rateLimitMaxRequests: 30,
    dailyTokenLimit: 50000,
    dailyBudgetUsd: 5,
    reservedOutputTokens: 1200,
    providers: {
      'vertex-gemini': {
        provider: 'vertex-gemini',
        model: 'gemini-3.6-flash',
        project: 'test-project',
        location: 'global',
        apiVersion: 'v1',
        timeoutMs: 45000,
        pricing: {
          models: {
            'gemini-3.6-flash': {
              // Fixture de pruebas; produccion debe obtener pricing aprobado
              // desde runtimeConfig/ai o entorno, no desde tests.
              inputPer1kTokensUsd: 0.1,
              cachedInputPer1kTokensUsd: 0.02,
              outputPer1kTokensUsd: 0.4,
              reasoningTokenTreatment: 'billable',
              reasoningPer1kTokensUsd: 0.3,
            },
          },
        },
      },
    },
    source: 'runtimeConfig/ai',
    ...overrides,
  };
}

async function loadAiEndpoint({
  store,
  verifyIdToken,
  geminiImpl,
  config = createConfig(),
  exportName = 'aiHandler',
  storageFiles = {},
}) {
  const firestore = createFirestore(store);
  const firebaseAdmin = {
    initializeAdminApp() {},
    getAdminAuth() {
      return {
        verifyIdToken,
        async setCustomUserClaims() {},
        async revokeRefreshTokens() {},
      };
    },
    getAdminFirestore() {
      return firestore;
    },
    getAdminStorage() {
      return {
        bucket() {
          return {
            file(storagePath) {
              const file = storageFiles[storagePath] || {
                buffer: Buffer.from('%PDF-1.4\nBT (Contexto financiero validado) Tj ET\n%%EOF', 'latin1'),
                metadata: { size: 54, contentType: 'application/pdf', name: storagePath },
              };
              return {
                async getMetadata() {
                  return [{ size: file.metadata?.size || file.buffer.length, contentType: file.metadata?.contentType, name: file.metadata?.name || storagePath }];
                },
                async download() {
                  return [file.buffer];
                },
              };
            },
          };
        },
      };
    },
  };
  const modulePath = fileURLToPath(MODULE_PATH);
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === './firebaseAdmin' || request === '../firebaseAdmin') return firebaseAdmin;
    if (request === 'firebase-functions/v2/https') return { onRequest: (_options, handler) => handler };
    if (request === 'firebase-functions/v2/scheduler') return { onSchedule: (_options, handler) => handler };
    if (request === 'firebase-functions/v2/firestore') return { onDocumentWritten: (_path, handler) => handler };
    if (request === './geminiVertexAdapter' || request === './handlers/geminiVertexAdapter') {
      return { callGeminiVertexAdapter: geminiImpl };
    }
    if (request === '../config' || request === './config') {
      return {
        DEFAULT_AI_REQUEST_TIMEOUT_MS: 45000,
        DEFAULT_VERTEX_API_VERSION: 'v1',
        DEFAULT_VERTEX_GEMINI_MODEL: 'gemini-3.6-flash',
        DEFAULT_VERTEX_GEMINI_PROVIDER: 'vertex-gemini',
        getAiRuntimeConfig: async () => config,
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    for (const key of Object.keys(realRequire.cache)) {
      if (key.includes('/functions/')) delete realRequire.cache[key];
    }
    const loaded = realRequire(modulePath);
    return loaded._test[exportName];
  } finally {
    Module._load = originalLoad;
  }
}

function createReq({ token = 'valid-token', body = {}, method = 'POST', origin = '' } = {}) {
  const headers = new Map();
  if (token) headers.set('authorization', `Bearer ${token}`);
  headers.set('x-correlation-id', 'test-correlation');
  if (origin) headers.set('origin', origin);

  return {
    method,
    body,
    get(name) {
      return headers.get(String(name).toLowerCase()) || '';
    },
  };
}

function createRes() {
  return {
    headers: {},
    statusCode: undefined,
    payload: undefined,
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
    send(payload) {
      this.payload = payload;
      return this;
    },
  };
}

function seedBase(overrides = {}) {
  return createStore({
    companies: {
      validCompany: { status: 'active', ownerUid: 'owner-uid' },
      inactiveCompany: { status: 'inactive', ownerUid: 'owner-uid' },
      memberCompany: { status: 'active', ownerUid: 'other-owner' },
    },
    companyMembers: {
      memberCompany_memberUid: { companyId: 'memberCompany', userUid: 'memberUid', status: 'active', role: 'admin' },
      memberCompany_inactiveMember: { companyId: 'memberCompany', userUid: 'inactiveMember', status: 'inactive', role: 'admin' },
      memberCompany_blockedRole: { companyId: 'memberCompany', userUid: 'blockedRole', status: 'active', role: 'guest' },
    },
    companyEntitlements: {
      validCompany: { companyId: 'validCompany', plan: 'pro', status: 'active', aiAccess: true, currentPeriodEnd: '2999-01-01T00:00:00.000Z' },
      memberCompany: { companyId: 'memberCompany', plan: 'pro', status: 'active', aiAccess: true, currentPeriodEnd: '2999-01-01T00:00:00.000Z' },
    },
    documents: {
      validDoc: { companyId: 'validCompany', storagePath: 'companies/validCompany/documents/validDoc/doc.pdf' },
      otherTenantDoc: { companyId: 'otherCompany', storagePath: 'companies/otherCompany/documents/otherTenantDoc/doc.pdf' },
      manipulatedPathDoc: { companyId: 'validCompany', storagePath: 'companies/otherCompany/documents/secret/doc.pdf' },
    },
    aiRateLimits: overrides.aiRateLimits || {},
    aiUsage: overrides.aiUsage || {},
  });
}

async function exercise({
  store = seedBase(),
  uid = 'owner-uid',
  token = 'valid-token',
  body,
  geminiImpl,
  config,
  origin,
  storageFiles = {},
} = {}) {
  const handler = await loadAiEndpoint({
    store,
    verifyIdToken: async (receivedToken) => {
      if (receivedToken !== 'valid-token') throw new Error('bad token');
      return { uid };
    },
    geminiImpl: geminiImpl || (async () => ({
      outputText: 'Respuesta IA de prueba',
      provider: 'vertex-gemini',
      model: 'gemini-3.6-flash',
      usage: { input_tokens: 11, output_tokens: 7, total_tokens: 18, cached_input_tokens: 0, reasoning_tokens: 0, tool_use_prompt_tokens: 0 },
      usageAvailable: true,
      finishReason: 'STOP',
    })),
    config: config || createConfig(),
    storageFiles,
  });
  const res = createRes();
  await handler(createReq({ token, body, origin }), res);
  return res;
}

describe('endpoint IA', () => {
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    process.env.AI_RATE_LIMIT_MAX_REQUESTS = '30';
    process.env.AI_RATE_LIMIT_WINDOW_MS = '60000';
    process.env.AI_DAILY_TOKEN_LIMIT = '50000';
    process.env.AI_DAILY_BUDGET_USD = '5';
    process.env.AI_RESERVED_OUTPUT_TOKENS = '1200';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('usa orígenes CORS de producción por defecto', async () => {
    delete process.env.ALLOWED_ORIGINS;
    const getAllowedOrigins = await loadAiEndpoint({
      store: seedBase(),
      verifyIdToken: async () => ({ uid: 'owner-uid' }),
      geminiImpl: async () => ({ outputText: 'ok', provider: 'vertex-gemini', model: 'gemini-3.6-flash', usage: {}, usageAvailable: false }),
      exportName: 'getAllowedOrigins',
    });

    assert.deepEqual(Array.from(getAllowedOrigins()), [
      'https://gemailla.com',
      'https://www.gemailla.com',
      'https://gemailla-enterprise.firebaseapp.com',
      'https://gemailla-enterprise.web.app',
    ]);
  });

  it('responde 403 para origen CORS no permitido antes de llamar a Vertex', async () => {
    process.env.ALLOWED_ORIGINS = 'https://allowed.example';
    let geminiCalls = 0;
    const handler = await loadAiEndpoint({
      store: seedBase(),
      verifyIdToken: async () => ({ uid: 'owner-uid' }),
      geminiImpl: async () => {
        geminiCalls += 1;
        throw new Error('Vertex no debe llamarse');
      },
    });
    const res = createRes();

    await handler(createReq({ origin: 'https://evil.example', body: { companyId: 'validCompany', prompt: 'Hola' } }), res);

    assert.equal(res.statusCode, 403);
    assert.match(res.payload.error, /CORS no permitido/);
    assert.equal(geminiCalls, 0);
  });

  it('responde 200 en el caso válido y registra costo de IA con Vertex', async () => {
    const store = seedBase();
    store.set('documents/validDoc', { companyId: 'validCompany', storagePath: 'companies/validCompany/documents/validDoc/doc.txt' });

    const res = await exercise({
      store,
      body: { companyId: 'validCompany', prompt: 'Hola', documentIds: ['validDoc'], integration: 'ellmer' },
      storageFiles: {
        'companies/validCompany/documents/validDoc/doc.txt': {
          buffer: Buffer.from('Contexto financiero validado', 'utf8'),
          metadata: { size: 28, contentType: 'text/plain', name: 'companies/validCompany/documents/validDoc/doc.txt' },
        },
      },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.response, 'Respuesta IA de prueba');
    assert.equal(res.payload.companyId, 'validCompany');
    assert.equal(res.payload.provider, 'vertex-gemini');
    assert.equal(res.payload.model, 'gemini-3.6-flash');
    assert.equal(res.payload.tokens, 18);
    assertCloseTo(res.payload.costo, 0.0039);

    const costLogs = Array.from(store.entries()).filter(([key]) => key.startsWith('aiCostLogs/')).map(([, value]) => value);
    assert.equal(costLogs.length, 1);
    assert.equal(costLogs[0].tokens, 18);
    assert.equal(costLogs[0].model, 'gemini-3.6-flash');
    assertCloseTo(costLogs[0].costo, 0.0039);
    assert.equal(costLogs[0].integration, 'ellmer');
  });

  it('integration no selecciona provider ni model', async () => {
    const res = await exercise({
      body: { companyId: 'validCompany', prompt: 'Hola', integration: 'openai' },
      geminiImpl: async () => ({
        outputText: 'Gemini manda',
        provider: 'vertex-gemini',
        model: 'gemini-3.6-flash',
        usage: { input_tokens: 11, output_tokens: 7, total_tokens: 18, cached_input_tokens: 0, reasoning_tokens: 0, tool_use_prompt_tokens: 0 },
        usageAvailable: true,
        finishReason: 'STOP',
      }),
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.provider, 'vertex-gemini');
    assert.equal(res.payload.model, 'gemini-3.6-flash');
    assert.equal(res.payload.response, 'Gemini manda');
  });

  it('normaliza integration=openai a gemailla-ai en aiCostLogs', async () => {
    const store = seedBase();
    const res = await exercise({
      store,
      body: { companyId: 'validCompany', prompt: 'Hola', integration: 'openai' },
    });

    assert.equal(res.statusCode, 200);

    const costLogs = Array.from(store.entries()).filter(([key]) => key.startsWith('aiCostLogs/')).map(([, value]) => value);
    assert.equal(costLogs.length, 1);
    assert.equal(costLogs[0].integration, 'gemailla-ai');
  });

  it('procesa response_json_schema con Gemini y devuelve JSON estructurado', async () => {
    const schema = {
      type: 'object',
      properties: {
        docType: { type: 'string' },
        total: { type: 'number' },
      },
      required: ['docType', 'total'],
    };

    const res = await exercise({
      body: { companyId: 'validCompany', prompt: 'Analiza documento', response_json_schema: schema },
      geminiImpl: async (params) => {
        assert.deepEqual(params.responseJsonSchema, schema);
        return {
          outputText: JSON.stringify({ docType: 'factura', total: 123.45 }),
          provider: 'vertex-gemini',
          model: 'gemini-3.6-flash',
          usage: { total_tokens: 12, input_tokens: 8, output_tokens: 4, cached_input_tokens: 0, reasoning_tokens: 0, tool_use_prompt_tokens: 0 },
          usageAvailable: true,
          finishReason: 'STOP',
        };
      },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.docType, 'factura');
    assert.equal(res.payload.total, 123.45);
    assert.deepEqual(res.payload.response, { docType: 'factura', total: 123.45 });
  });

  it('responde 502 si Gemini no entrega JSON válido para response_json_schema', async () => {
    const res = await exercise({
      body: { companyId: 'validCompany', prompt: 'Analiza documento', response_json_schema: { type: 'object', properties: { ok: { type: 'boolean' } } } },
      geminiImpl: async () => ({
        outputText: 'texto libre no json',
        provider: 'vertex-gemini',
        model: 'gemini-3.6-flash',
        usage: { total_tokens: 4, input_tokens: 2, output_tokens: 2, cached_input_tokens: 0, reasoning_tokens: 0, tool_use_prompt_tokens: 0 },
        usageAvailable: true,
        finishReason: 'STOP',
      }),
    });

    assert.equal(res.statusCode, 502);
    assert.match(res.payload.error, /JSON válido/);
  });

  it('conserva la reserva cuando usageMetadata falta en Vertex', async () => {
    const store = seedBase();
    const res = await exercise({
      store,
      body: { companyId: 'validCompany', prompt: 'Hola' },
      geminiImpl: async () => ({
        outputText: 'Sin usage metadata',
        provider: 'vertex-gemini',
        model: 'gemini-3.6-flash',
        usage: {},
        usageAvailable: false,
        finishReason: 'STOP',
      }),
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.tokens, null);
    assert.equal(res.payload.costUsd, null);

    const usageDocs = Array.from(store.entries()).filter(([key]) => key.startsWith('aiUsage/')).map(([, value]) => value);
    assert.equal(usageDocs.length, 1);
    assert.equal(usageDocs[0].pendingUsageMetadataCount, 1);
    assert.equal(usageDocs[0].reservedTokens > 0, true);
  });

  it('bloquea por rate limiting antes de llamar a Vertex', async () => {
    const store = seedBase({ aiRateLimits: { 'validCompany_owner-uid': { windowStartedAtMs: Date.now(), requestCount: 1 } } });
    let geminiCalls = 0;

    const res = await exercise({
      store,
      body: { companyId: 'validCompany', prompt: 'Hola' },
      geminiImpl: async () => {
        geminiCalls += 1;
        return { outputText: 'No debe llamarse', provider: 'vertex-gemini', model: 'gemini-3.6-flash', usage: {}, usageAvailable: false };
      },
      config: createConfig({ rateLimitMaxRequests: 1 }),
    });

    assert.equal(res.statusCode, 429);
    assert.match(res.payload.error, /Límite de frecuencia/);
    assert.equal(geminiCalls, 0);
  });

  it('bloquea por cuota diaria de tokens antes de llamar a Vertex', async () => {
    let geminiCalls = 0;

    const res = await exercise({
      body: { companyId: 'validCompany', prompt: 'Hola' },
      geminiImpl: async () => {
        geminiCalls += 1;
        return { outputText: 'No debe llamarse', provider: 'vertex-gemini', model: 'gemini-3.6-flash', usage: {}, usageAvailable: false };
      },
      config: createConfig({ dailyTokenLimit: 10 }),
    });

    assert.equal(res.statusCode, 429);
    assert.match(res.payload.error, /Cuota diaria de tokens/);
    assert.equal(geminiCalls, 0);
  });

  it('bloquea por presupuesto diario antes de llamar a Vertex', async () => {
    let geminiCalls = 0;

    const res = await exercise({
      body: { companyId: 'validCompany', prompt: 'Hola' },
      geminiImpl: async () => {
        geminiCalls += 1;
        return { outputText: 'No debe llamarse', provider: 'vertex-gemini', model: 'gemini-3.6-flash', usage: {}, usageAvailable: false };
      },
      config: createConfig({ dailyBudgetUsd: 0.000001 }),
    });

    assert.equal(res.statusCode, 429);
    assert.match(res.payload.error, /Presupuesto diario/);
    assert.equal(geminiCalls, 0);
  });

  it('falla antes de llamar a Vertex cuando falta pricing aprobado o modelo exacto', async () => {
    let geminiCalls = 0;
    const missingPricing = await exercise({
      body: { companyId: 'validCompany', prompt: 'Hola' },
      geminiImpl: async () => {
        geminiCalls += 1;
        return { outputText: 'No debe llamarse', provider: 'vertex-gemini', model: 'gemini-3.6-flash', usage: {}, usageAvailable: false };
      },
      config: createConfig({
        providers: {
          'vertex-gemini': {
            ...createConfig().providers['vertex-gemini'],
            pricing: {},
          },
        },
      }),
    });
    assert.equal(missingPricing.statusCode, 503);
    assert.match(missingPricing.payload.error, /Falta configuracion aprobada de precios/);

    const missingModel = await exercise({
      body: { companyId: 'validCompany', prompt: 'Hola' },
      geminiImpl: async () => {
        geminiCalls += 1;
        return { outputText: 'No debe llamarse', provider: 'vertex-gemini', model: 'gemini-3.6-flash', usage: {}, usageAvailable: false };
      },
      config: createConfig({
        model: 'gemini-no-aprobado',
        providers: {
          'vertex-gemini': {
            ...createConfig().providers['vertex-gemini'],
            model: 'gemini-no-aprobado',
          },
        },
      }),
    });
    assert.equal(missingModel.statusCode, 503);
    assert.match(missingModel.payload.error, /modelo configurado no esta aprobado/i);
    assert.equal(geminiCalls, 0);
  });
});
