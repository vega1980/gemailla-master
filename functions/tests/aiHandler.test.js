const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');

function createStore(initial = {}) {
  const store = new Map();
  for (const [collection, docs] of Object.entries(initial)) {
    for (const [id, data] of Object.entries(docs)) {
      store.set(`${collection}/${id}`, structuredClone(data));
    }
  }
  return store;
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

function seedStore(overrides = {}) {
  return createStore({
    companies: {
      validCompany: { status: 'active', ownerUid: 'owner-uid' },
      memberCompany: { status: 'active', ownerUid: 'other-owner' },
    },
    companyMembers: {
      memberCompany_memberUid: { companyId: 'memberCompany', userUid: 'memberUid', status: 'active', role: 'admin' },
      memberCompany_guestUid: { companyId: 'memberCompany', userUid: 'guestUid', status: 'active', role: 'guest' },
    },
    companyEntitlements: {
      validCompany: { companyId: 'validCompany', plan: 'pro', status: 'active', aiAccess: true, currentPeriodEnd: '2999-01-01T00:00:00.000Z' },
      memberCompany: { companyId: 'memberCompany', plan: 'pro', status: 'active', aiAccess: true, currentPeriodEnd: '2999-01-01T00:00:00.000Z' },
    },
    documents: {
      validDoc: { companyId: 'validCompany', storagePath: 'companies/validCompany/documents/validDoc/doc.txt' },
      otherTenantDoc: { companyId: 'otherCompany', storagePath: 'companies/otherCompany/documents/otherDoc/doc.txt' },
    },
    aiRateLimits: overrides.aiRateLimits || {},
    aiUsage: overrides.aiUsage || {},
  });
}

function createReq({ token = 'valid-token', body = {}, method = 'POST' } = {}) {
  const headers = new Map();
  if (token) headers.set('authorization', `Bearer ${token}`);
  headers.set('x-correlation-id', 'corr-ai-handler');
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
    statusCode: 200,
    payload: null,
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
  };
}

function createConfig(provider = 'openai', overrides = {}) {
  const model = provider === 'openai' ? 'gpt-4o-mini' : 'gemini-2.5-pro';
  return {
    provider,
    model,
    rateLimitWindowMs: 60000,
    rateLimitMaxRequests: 30,
    dailyTokenLimit: 50000,
    dailyBudgetUsd: 5,
    reservedOutputTokens: 1200,
    costPer1kTokensUsd: 0.002,
    providers: {
      openai: {
        provider: 'openai',
        enabled: true,
        model: 'gpt-4o-mini',
        timeoutMs: 45000,
        pricing: { costPer1kTokensUsd: 0.002 },
      },
      'vertex-gemini': {
        provider: 'vertex-gemini',
        enabled: true,
        model: 'gemini-2.5-pro',
        project: 'test-project',
        location: 'global',
        apiVersion: 'v1',
        timeoutMs: 3210,
        pricing: {
          models: {
            'gemini-2.5-pro': {
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
    ...overrides,
  };
}

function loadAiHandler({
  store = seedStore(),
  config = createConfig(),
  verifyIdToken = async (token) => {
    if (token !== 'valid-token') throw new Error('bad token');
    return { uid: 'owner-uid' };
  },
  fetchImpl = async () => ({
    ok: true,
    status: 200,
    async json() {
      return { output_text: 'OpenAI OK', usage: { input_tokens: 10, output_tokens: 8, total_tokens: 18 } };
    },
  }),
  geminiImpl = async () => ({
    outputText: 'Gemini OK',
    provider: 'vertex-gemini',
    model: 'gemini-2.5-pro',
    usage: { input_tokens: 1000, output_tokens: 500, total_tokens: 1900, cached_input_tokens: 200, reasoning_tokens: 100, tool_use_prompt_tokens: 300 },
    usageAvailable: true,
    finishReason: 'STOP',
  }),
  buildDocumentContext = async (documents) => documents.length ? 'contexto validado' : '',
}) {
  process.env.OPENAI_API_KEY = 'test-openai-key';
  const firestore = createFirestore(store);
  const admin = {
    auth() {
      return { verifyIdToken };
    },
    firestore() {
      return firestore;
    },
  };

  const originalLoad = Module._load;
  const modulePath = require.resolve('../handlers/aiHandler');
  global.fetch = fetchImpl;

  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'firebase-admin') return admin;
    if (request === '../config') {
      return {
        DEFAULT_AI_REQUEST_TIMEOUT_MS: 45000,
        DEFAULT_COST_PER_1K_TOKENS_USD: 0.002,
        DEFAULT_OPENAI_MODEL: 'gpt-4o-mini',
        DEFAULT_VERTEX_API_VERSION: 'v1',
        DEFAULT_VERTEX_GEMINI_PROVIDER: 'vertex-gemini',
        getAiRuntimeConfig: async () => config,
      };
    }
    if (request === './documentContextBuilder') {
      return { buildDocumentContext };
    }
    if (request === './geminiVertexAdapter') {
      return { callGeminiVertexAdapter: geminiImpl };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    delete require.cache[modulePath];
    return require(modulePath);
  } finally {
    Module._load = originalLoad;
  }
}

function collectDocs(store, collectionName) {
  return Array.from(store.entries())
    .filter(([key]) => key.startsWith(`${collectionName}/`))
    .map(([, value]) => value);
}

test('aiHandler mantiene OpenAI como comportamiento actual y sin fallback automatico', async () => {
  const store = seedStore();
  let openAiCalls = 0;
  let geminiCalls = 0;
  const { aiHandler } = loadAiHandler({
    store,
    config: createConfig('openai'),
    fetchImpl: async () => {
      openAiCalls += 1;
      return {
        ok: true,
        status: 200,
        async json() {
          return { output_text: 'OpenAI vigente', usage: { input_tokens: 11, output_tokens: 7, total_tokens: 18 } };
        },
      };
    },
    geminiImpl: async () => {
      geminiCalls += 1;
      return { outputText: 'no debe llamarse', provider: 'vertex-gemini', model: 'gemini-2.5-pro', usage: {}, usageAvailable: false };
    },
  });

  const res = createRes();
  await aiHandler(createReq({ body: { companyId: 'validCompany', prompt: 'Hola', integration: 'gemini.R' } }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.provider, 'openai');
  assert.equal(res.payload.model, 'gpt-4o-mini');
  assert.equal(res.payload.response, 'OpenAI vigente');
  assert.equal(openAiCalls, 1);
  assert.equal(geminiCalls, 0);
  assert.equal(collectDocs(store, 'aiCostLogs').length, 1);
});

test('aiHandler usa vertex-gemini desde backend, integration no cambia provider y distingue costos por provider/model/reasoning/cache', async () => {
  const store = seedStore();
  let openAiCalls = 0;
  let geminiCalls = 0;
  const { aiHandler } = loadAiHandler({
    store,
    config: createConfig('vertex-gemini'),
    fetchImpl: async () => {
      openAiCalls += 1;
      throw new Error('OpenAI no debe llamarse');
    },
    geminiImpl: async (params) => {
      geminiCalls += 1;
      assert.equal(params.providerConfiguration.project, 'test-project');
      assert.equal(params.providerConfiguration.location, 'global');
      assert.equal(params.providerConfiguration.apiVersion, 'v1');
      assert.equal(params.providerConfiguration.timeoutMs, 3210);
      return {
        outputText: 'Gemini interno',
        provider: 'vertex-gemini',
        model: 'gemini-2.5-pro',
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
          total_tokens: 1900,
          cached_input_tokens: 200,
          reasoning_tokens: 100,
          tool_use_prompt_tokens: 300,
        },
        usageAvailable: true,
        finishReason: 'STOP',
      };
    },
  });

  const res = createRes();
  await aiHandler(createReq({ body: { companyId: 'validCompany', prompt: 'Hola', integration: 'openai' } }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.provider, 'vertex-gemini');
  assert.equal(res.payload.model, 'gemini-2.5-pro');
  assert.equal(res.payload.response, 'Gemini interno');
  assert.equal(openAiCalls, 0);
  assert.equal(geminiCalls, 1);
  assert.equal(res.payload.tokens, 1900);
  assert.equal(res.payload.costUsd, 0.344);

  const costLogs = collectDocs(store, 'aiCostLogs');
  assert.equal(costLogs.length, 1);
  assert.equal(costLogs[0].provider, 'vertex-gemini');
  assert.equal(costLogs[0].model, 'gemini-2.5-pro');
  assert.equal(costLogs[0].integration, 'openai');
  assert.equal(costLogs[0].costUsd, 0.344);
});

test('aiHandler falla de forma controlada para proveedor desconocido y no hace fallback', async () => {
  const store = seedStore();
  let openAiCalls = 0;
  let geminiCalls = 0;
  const { aiHandler } = loadAiHandler({
    store,
    config: createConfig('anthropic', { model: 'claude-x' }),
    fetchImpl: async () => {
      openAiCalls += 1;
      return { ok: true, status: 200, async json() { return { output_text: 'x' }; } };
    },
    geminiImpl: async () => {
      geminiCalls += 1;
      return { outputText: 'x', provider: 'vertex-gemini', model: 'gemini-2.5-pro', usage: {}, usageAvailable: false };
    },
  });

  const res = createRes();
  await aiHandler(createReq({ body: { companyId: 'validCompany', prompt: 'Hola' } }), res);

  assert.equal(res.statusCode, 501);
  assert.match(res.payload.error, /Proveedor LLM no soportado/);
  assert.equal(openAiCalls, 0);
  assert.equal(geminiCalls, 0);
  assert.equal(collectDocs(store, 'aiUsage').length, 0);
  assert.equal(collectDocs(store, 'aiRateLimits').length, 0);
});

test('aiHandler autentica y autoriza antes del proveedor, conserva aislamiento multiempresa y rechazo de documentos cruzados', async () => {
  let providerCalls = 0;
  const providerTracker = async () => {
    providerCalls += 1;
    return { outputText: 'x', provider: 'vertex-gemini', model: 'gemini-2.5-pro', usage: {}, usageAvailable: false };
  };

  const authFail = loadAiHandler({
    config: createConfig('vertex-gemini'),
    verifyIdToken: async () => {
      throw new Error('bad token');
    },
    geminiImpl: providerTracker,
  });
  const authRes = createRes();
  await authFail.aiHandler(createReq({ body: { companyId: 'validCompany', prompt: 'Hola' } }), authRes);
  assert.equal(authRes.statusCode, 401);
  assert.equal(providerCalls, 0);

  const roleFail = loadAiHandler({
    config: createConfig('vertex-gemini'),
    verifyIdToken: async () => ({ uid: 'guestUid' }),
    geminiImpl: providerTracker,
  });
  const roleRes = createRes();
  await roleFail.aiHandler(createReq({ body: { companyId: 'memberCompany', prompt: 'Hola' } }), roleRes);
  assert.equal(roleRes.statusCode, 403);
  assert.equal(providerCalls, 0);

  const tenantFail = loadAiHandler({
    config: createConfig('vertex-gemini'),
    geminiImpl: providerTracker,
  });
  const tenantRes = createRes();
  await tenantFail.aiHandler(createReq({ body: { companyId: 'validCompany', prompt: 'Hola', documentIds: ['otherTenantDoc'] } }), tenantRes);
  assert.equal(tenantRes.statusCode, 403);
  assert.match(tenantRes.payload.error, /no pertenece a la empresa validada/);
  assert.equal(providerCalls, 0);
});

test('aiHandler procesa JSON estructurado exclusivamente ahi y rechaza JSON invalido o texto adicional', async () => {
  const schema = { type: 'object', properties: { total: { type: 'number' } } };

  const valid = loadAiHandler({
    config: createConfig('vertex-gemini'),
    geminiImpl: async () => ({
      outputText: '{"total":123.45}',
      provider: 'vertex-gemini',
      model: 'gemini-2.5-pro',
      usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15, cached_input_tokens: 0, reasoning_tokens: 0, tool_use_prompt_tokens: 0 },
      usageAvailable: true,
      finishReason: 'STOP',
    }),
  });
  const validRes = createRes();
  await valid.aiHandler(createReq({ body: { companyId: 'validCompany', prompt: 'Hola', response_json_schema: schema } }), validRes);
  assert.equal(validRes.statusCode, 200);
  assert.equal(validRes.payload.total, 123.45);
  assert.deepEqual(validRes.payload.response, { total: 123.45 });

  const invalid = loadAiHandler({
    config: createConfig('vertex-gemini'),
    geminiImpl: async () => ({
      outputText: 'texto libre',
      provider: 'vertex-gemini',
      model: 'gemini-2.5-pro',
      usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15, cached_input_tokens: 0, reasoning_tokens: 0, tool_use_prompt_tokens: 0 },
      usageAvailable: true,
      finishReason: 'STOP',
    }),
  });
  const invalidRes = createRes();
  await invalid.aiHandler(createReq({ body: { companyId: 'validCompany', prompt: 'Hola', response_json_schema: schema } }), invalidRes);
  assert.equal(invalidRes.statusCode, 502);
  assert.match(invalidRes.payload.error, /JSON válido/);

  const extraText = loadAiHandler({
    config: createConfig('vertex-gemini'),
    geminiImpl: async () => ({
      outputText: 'antes {"total":123.45} despues',
      provider: 'vertex-gemini',
      model: 'gemini-2.5-pro',
      usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15, cached_input_tokens: 0, reasoning_tokens: 0, tool_use_prompt_tokens: 0 },
      usageAvailable: true,
      finishReason: 'STOP',
    }),
  });
  const extraRes = createRes();
  await extraText.aiHandler(createReq({ body: { companyId: 'validCompany', prompt: 'Hola', response_json_schema: schema } }), extraRes);
  assert.equal(extraRes.statusCode, 502);
  assert.match(extraRes.payload.error, /JSON válido/);
});

test('aiHandler conserva la reserva cuando falta usageMetadata de vertex-gemini, no inventa costos y conserva correlationId en auditoria', async () => {
  const store = seedStore();
  const { aiHandler } = loadAiHandler({
    store,
    config: createConfig('vertex-gemini'),
    geminiImpl: async () => ({
      outputText: 'Gemini sin usage',
      provider: 'vertex-gemini',
      model: 'gemini-2.5-pro',
      usage: {},
      usageAvailable: false,
      finishReason: 'STOP',
    }),
  });

  const res = createRes();
  await aiHandler(createReq({ body: { companyId: 'validCompany', prompt: 'Hola' } }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.provider, 'vertex-gemini');
  assert.equal(res.payload.tokens, null);
  assert.equal(res.payload.costUsd, null);

  const usageDocs = collectDocs(store, 'aiUsage');
  assert.equal(usageDocs.length, 1);
  assert.equal(usageDocs[0].reservedTokens > 0, true);
  assert.equal(usageDocs[0].reservedBudgetUsd > 0, true);
  assert.equal(usageDocs[0].pendingUsageMetadataCount, 1);
  assert.equal(usageDocs[0].tokensUsed || 0, 0);
  assert.equal(collectDocs(store, 'aiCostLogs').length, 0);

  const auditLogs = collectDocs(store, 'aiAuditLogs');
  assert.equal(auditLogs.length, 2);
  assert.equal(auditLogs.every((entry) => entry.correlationId === 'corr-ai-handler'), true);
});

test('aiHandler estima la reserva de Vertex Gemini con pricing propio del provider/model configurado', async () => {
  const store = seedStore();
  const prompt = 'Hola';
  const { aiHandler } = loadAiHandler({
    store,
    config: createConfig('vertex-gemini'),
    geminiImpl: async () => ({
      outputText: 'Gemini con pricing propio',
      provider: 'vertex-gemini',
      model: 'gemini-2.5-pro',
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        total_tokens: 15,
        cached_input_tokens: 0,
        reasoning_tokens: 0,
        tool_use_prompt_tokens: 0,
      },
      usageAvailable: true,
      finishReason: 'STOP',
    }),
  });

  const res = createRes();
  await aiHandler(createReq({ body: { companyId: 'validCompany', prompt } }), res);

  assert.equal(res.statusCode, 200);

  const usageDocs = collectDocs(store, 'aiUsage');
  assert.equal(usageDocs.length, 1);
  assert.equal(usageDocs[0].reservedBudgetUsd, 0);
  assert.equal(usageDocs[0].budgetUsedUsd, 0.003);

  const auditLogs = collectDocs(store, 'aiAuditLogs');
  assert.equal(auditLogs.length, 2);
  assert.equal(auditLogs[0].estimatedCostUsd, 0.4801);
  assert.equal(auditLogs[1].estimatedCostUsd, 0.4801);
});

test('aiHandler falla antes de llamar a Vertex Gemini cuando falta pricing aprobado para el modelo', async () => {
  const store = seedStore();
  let geminiCalls = 0;
  const { aiHandler } = loadAiHandler({
    store,
    config: createConfig('vertex-gemini', {
      providers: {
        ...createConfig('vertex-gemini').providers,
        'vertex-gemini': {
          ...createConfig('vertex-gemini').providers['vertex-gemini'],
          pricing: {},
        },
      },
    }),
    geminiImpl: async () => {
      geminiCalls += 1;
      return {
        outputText: 'no debe llamarse',
        provider: 'vertex-gemini',
        model: 'gemini-2.5-pro',
        usage: {},
        usageAvailable: false,
        finishReason: 'STOP',
      };
    },
  });

  const res = createRes();
  await aiHandler(createReq({ body: { companyId: 'validCompany', prompt: 'Hola' } }), res);

  assert.equal(res.statusCode, 503);
  assert.match(res.payload.error, /Falta configuracion aprobada de precios para vertex-gemini\/gemini-2.5-pro/);
  assert.equal(geminiCalls, 0);
  assert.equal(collectDocs(store, 'aiUsage').length, 0);
});
