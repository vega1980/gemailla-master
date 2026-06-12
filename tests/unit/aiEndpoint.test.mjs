import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { describe, it, beforeEach, afterEach } from 'node:test';
import vm from 'node:vm';

const realRequire = createRequire(import.meta.url);
const MODULE_PATH = new URL('../../functions/index.js', import.meta.url);
const ORIGINAL_ENV = { ...process.env };

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

async function loadAiEndpoint({ store, verifyIdToken, fetchImpl }) {
  const source = await readFile(MODULE_PATH, 'utf8');
  const firestore = createFirestore(store);
  const admin = {
    initializeApp() {},
    auth() {
      return { verifyIdToken };
    },
    firestore() {
      return firestore;
    },
  };
  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    process,
    console,
    fetch: fetchImpl,
    require(specifier) {
      if (specifier === 'firebase-admin') return admin;
      if (specifier === 'firebase-functions/v2/https') return { onRequest: (_options, handler) => handler };
      if (specifier === 'firebase-functions/params') return { defineSecret: () => ({ value: () => process.env.OPENAI_API_KEY }) };
      return realRequire(specifier);
    },
  };
  vm.runInNewContext(source, sandbox, { filename: 'functions/index.js' });
  return module.exports._test.aiHandler;
}

function createReq({ token = 'valid-token', body = {}, method = 'POST' } = {}) {
  const headers = new Map();
  if (token) headers.set('authorization', `Bearer ${token}`);
  headers.set('x-correlation-id', 'test-correlation');

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
    documents: {
      validDoc: { companyId: 'validCompany', storagePath: 'companies/validCompany/doc.pdf' },
      otherTenantDoc: { companyId: 'otherCompany', storagePath: 'companies/otherCompany/doc.pdf' },
    },
    aiRateLimits: overrides.aiRateLimits || {},
    aiUsage: overrides.aiUsage || {},
  });
}

async function exercise({ store = seedBase(), uid = 'owner-uid', token = 'valid-token', body, fetchImpl } = {}) {
  const handler = await loadAiEndpoint({
    store,
    verifyIdToken: async (receivedToken) => {
      if (receivedToken !== 'valid-token') throw new Error('bad token');
      return { uid };
    },
    fetchImpl: fetchImpl || (async () => ({ ok: true, status: 200, async json() { return { output_text: 'Respuesta IA de prueba' }; } })),
  });
  const res = createRes();
  await handler(createReq({ token, body }), res);
  return res;
}

describe('endpoint IA', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.AI_RATE_LIMIT_MAX_REQUESTS = '30';
    process.env.AI_RATE_LIMIT_WINDOW_MS = '60000';
    process.env.AI_DAILY_TOKEN_LIMIT = '50000';
    process.env.AI_DAILY_BUDGET_USD = '5';
    process.env.AI_RESERVED_OUTPUT_TOKENS = '1200';
    process.env.AI_COST_PER_1K_TOKENS_USD = '0.002';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('responde 401 sin token', async () => {
    const res = await exercise({ token: null, body: { companyId: 'validCompany', prompt: 'Hola' } });

    assert.equal(res.statusCode, 401);
    assert.match(res.payload.error, /Autenticación requerida/);
  });

  it('responde 401 con token inválido', async () => {
    const res = await exercise({ token: 'invalid-token', body: { companyId: 'validCompany', prompt: 'Hola' } });

    assert.equal(res.statusCode, 401);
    assert.match(res.payload.error, /Token de Firebase inválido/);
  });

  it('responde 400 cuando companyId está ausente', async () => {
    const res = await exercise({ body: { prompt: 'Hola' } });

    assert.equal(res.statusCode, 400);
    assert.match(res.payload.error, /companyId es obligatorio/);
  });

  it('responde 403 cuando la empresa no existe', async () => {
    const res = await exercise({ body: { companyId: 'missingCompany', prompt: 'Hola' } });

    assert.equal(res.statusCode, 403);
    assert.match(res.payload.error, /Empresa no válida/);
  });

  it('responde 403 con membresía inválida', async () => {
    const res = await exercise({ uid: 'inactiveMember', body: { companyId: 'memberCompany', prompt: 'Hola' } });

    assert.equal(res.statusCode, 403);
    assert.match(res.payload.error, /membresía activa/);
  });

  it('responde 403 con rol insuficiente', async () => {
    const res = await exercise({ uid: 'blockedRole', body: { companyId: 'memberCompany', prompt: 'Hola' } });

    assert.equal(res.statusCode, 403);
    assert.match(res.payload.error, /rol no permite/);
  });

  it('responde 403 al solicitar un documento de otro tenant', async () => {
    const res = await exercise({ body: { companyId: 'validCompany', prompt: 'Analiza documento', documentIds: ['otherTenantDoc'] } });

    assert.equal(res.statusCode, 403);
    assert.match(res.payload.error, /no pertenece a la empresa validada/);
  });

  it('responde 200 en el caso válido', async () => {
    const res = await exercise({ body: { companyId: 'validCompany', prompt: 'Hola', documentIds: ['validDoc'] } });

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.response, 'Respuesta IA de prueba');
    assert.equal(res.payload.companyId, 'validCompany');
  });

  it('bloquea por rate limiting antes de llamar a OpenAI', async () => {
    process.env.AI_RATE_LIMIT_MAX_REQUESTS = '1';
    const store = seedBase({ aiRateLimits: { 'validCompany_owner-uid': { windowStartedAtMs: Date.now(), requestCount: 1 } } });
    let openAiCalls = 0;

    const res = await exercise({
      store,
      body: { companyId: 'validCompany', prompt: 'Hola' },
      fetchImpl: async () => {
        openAiCalls += 1;
        return { ok: true, status: 200, async json() { return { output_text: 'No debe llamarse' }; } };
      },
    });

    assert.equal(res.statusCode, 429);
    assert.match(res.payload.error, /Límite de frecuencia/);
    assert.equal(openAiCalls, 0);
  });

  it('bloquea por cuota diaria de tokens antes de llamar a OpenAI', async () => {
    process.env.AI_DAILY_TOKEN_LIMIT = '10';
    let openAiCalls = 0;

    const res = await exercise({
      body: { companyId: 'validCompany', prompt: 'Hola' },
      fetchImpl: async () => {
        openAiCalls += 1;
        return { ok: true, status: 200, async json() { return { output_text: 'No debe llamarse' }; } };
      },
    });

    assert.equal(res.statusCode, 429);
    assert.match(res.payload.error, /Cuota diaria de tokens/);
    assert.equal(openAiCalls, 0);
  });

  it('bloquea por presupuesto diario antes de llamar a OpenAI', async () => {
    process.env.AI_DAILY_BUDGET_USD = '0.000001';
    let openAiCalls = 0;

    const res = await exercise({
      body: { companyId: 'validCompany', prompt: 'Hola' },
      fetchImpl: async () => {
        openAiCalls += 1;
        return { ok: true, status: 200, async json() { return { output_text: 'No debe llamarse' }; } };
      },
    });

    assert.equal(res.statusCode, 429);
    assert.match(res.payload.error, /Presupuesto diario/);
    assert.equal(openAiCalls, 0);
  });
});
