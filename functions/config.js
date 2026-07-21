const admin = require('firebase-admin');

const DEFAULT_LLM_PROVIDER = 'openai';
const DEFAULT_VERTEX_GEMINI_PROVIDER = 'vertex-gemini';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 30;
const DEFAULT_DAILY_TOKEN_LIMIT = 50000;
const DEFAULT_DAILY_BUDGET_USD = 5;
const DEFAULT_RESERVED_OUTPUT_TOKENS = 1200;
const DEFAULT_COST_PER_1K_TOKENS_USD = 0.002;
const DEFAULT_AI_REQUEST_TIMEOUT_MS = 45 * 1000;
const DEFAULT_VERTEX_API_VERSION = 'v1';
const AI_RUNTIME_CONFIG_COLLECTION = 'runtimeConfig';
const AI_RUNTIME_CONFIG_DOC = 'ai';

let cachedAiRuntimeConfig = null;
let cachedAiRuntimeConfigLoadedAtMs = 0;
const AI_RUNTIME_CONFIG_CACHE_MS = 5 * 60 * 1000;

function getPositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getString(value, fallback) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  return candidate || fallback;
}

function getObject(value, fallback = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
}

function mergePlainObjects(base = {}, override = {}) {
  return {
    ...getObject(base),
    ...getObject(override),
  };
}

function normalizeProvider(value, fallback = DEFAULT_LLM_PROVIDER) {
  const candidate = getString(value, fallback).toLowerCase();
  return candidate || fallback;
}

function buildOpenAIProviderConfig() {
  return {
    provider: 'openai',
    enabled: true,
    model: getString(process.env.OPENAI_MODEL, DEFAULT_OPENAI_MODEL),
    timeoutMs: getPositiveNumber(process.env.AI_REQUEST_TIMEOUT_MS, DEFAULT_AI_REQUEST_TIMEOUT_MS),
    pricing: {
      costPer1kTokensUsd: getPositiveNumber(process.env.AI_COST_PER_1K_TOKENS_USD, DEFAULT_COST_PER_1K_TOKENS_USD),
    },
  };
}

function buildVertexGeminiProviderConfig() {
  return {
    provider: DEFAULT_VERTEX_GEMINI_PROVIDER,
    enabled: false,
    model: getString(process.env.VERTEX_GEMINI_MODEL || process.env.LLM_MODEL, ''),
    project: getString(process.env.VERTEX_GEMINI_PROJECT || process.env.GOOGLE_CLOUD_PROJECT, ''),
    location: getString(process.env.VERTEX_GEMINI_LOCATION || process.env.GOOGLE_CLOUD_LOCATION, ''),
    apiVersion: getString(process.env.VERTEX_GEMINI_API_VERSION, DEFAULT_VERTEX_API_VERSION),
    timeoutMs: getPositiveNumber(process.env.VERTEX_GEMINI_TIMEOUT_MS || process.env.AI_REQUEST_TIMEOUT_MS, DEFAULT_AI_REQUEST_TIMEOUT_MS),
    pricing: {},
  };
}

function getEnvAiRuntimeConfig() {
  const provider = normalizeProvider(process.env.LLM_PROVIDER, DEFAULT_LLM_PROVIDER);
  const openai = buildOpenAIProviderConfig();
  const vertexGemini = buildVertexGeminiProviderConfig();
  const model = provider === 'openai'
    ? getString(process.env.LLM_MODEL || openai.model, DEFAULT_OPENAI_MODEL)
    : getString(process.env.LLM_MODEL || vertexGemini.model, '');

  return {
    provider,
    model,
    rateLimitWindowMs: getPositiveNumber(process.env.AI_RATE_LIMIT_WINDOW_MS, DEFAULT_RATE_LIMIT_WINDOW_MS),
    rateLimitMaxRequests: getPositiveNumber(process.env.AI_RATE_LIMIT_MAX_REQUESTS, DEFAULT_RATE_LIMIT_MAX_REQUESTS),
    dailyTokenLimit: getPositiveNumber(process.env.AI_DAILY_TOKEN_LIMIT, DEFAULT_DAILY_TOKEN_LIMIT),
    dailyBudgetUsd: getPositiveNumber(process.env.AI_DAILY_BUDGET_USD, DEFAULT_DAILY_BUDGET_USD),
    reservedOutputTokens: getPositiveNumber(process.env.AI_RESERVED_OUTPUT_TOKENS, DEFAULT_RESERVED_OUTPUT_TOKENS),
    costPer1kTokensUsd: getPositiveNumber(process.env.AI_COST_PER_1K_TOKENS_USD, DEFAULT_COST_PER_1K_TOKENS_USD),
    providers: {
      openai,
      [DEFAULT_VERTEX_GEMINI_PROVIDER]: vertexGemini,
    },
    source: 'env',
  };
}

function mergeProviderConfig(baseProviderConfig, overrideProviderConfig = {}) {
  const base = getObject(baseProviderConfig);
  const override = getObject(overrideProviderConfig);
  return {
    ...base,
    ...override,
    pricing: mergePlainObjects(base.pricing, override.pricing),
  };
}

function mergeFirestoreAiRuntimeConfig(base, data = {}) {
  const pricing = data.pricing && typeof data.pricing === 'object' ? data.pricing : {};
  const limits = data.limits && typeof data.limits === 'object' ? data.limits : {};
  const providerOverrides = getObject(data.providers);
  const providers = {
    openai: mergeProviderConfig(base.providers?.openai, providerOverrides.openai),
    [DEFAULT_VERTEX_GEMINI_PROVIDER]: mergeProviderConfig(base.providers?.[DEFAULT_VERTEX_GEMINI_PROVIDER], providerOverrides[DEFAULT_VERTEX_GEMINI_PROVIDER]),
  };
  const provider = normalizeProvider(data.provider, base.provider);
  const providerDefaultModel = getString(providers[provider]?.model, provider === 'openai' ? DEFAULT_OPENAI_MODEL : '');

  return {
    provider,
    model: getString(data.model, providerDefaultModel || base.model),
    rateLimitWindowMs: getPositiveNumber(limits.rateLimitWindowMs ?? data.rateLimitWindowMs, base.rateLimitWindowMs),
    rateLimitMaxRequests: getPositiveNumber(limits.rateLimitMaxRequests ?? data.rateLimitMaxRequests, base.rateLimitMaxRequests),
    dailyTokenLimit: getPositiveNumber(limits.dailyTokenLimit ?? data.dailyTokenLimit, base.dailyTokenLimit),
    dailyBudgetUsd: getPositiveNumber(limits.dailyBudgetUsd ?? data.dailyBudgetUsd, base.dailyBudgetUsd),
    reservedOutputTokens: getPositiveNumber(limits.reservedOutputTokens ?? data.reservedOutputTokens, base.reservedOutputTokens),
    costPer1kTokensUsd: getPositiveNumber(pricing.costPer1kTokensUsd ?? data.costPer1kTokensUsd, base.costPer1kTokensUsd),
    providers,
    source: 'firestore',
  };
}

async function getAiRuntimeConfig({ forceRefresh = false } = {}) {
  const envConfig = getEnvAiRuntimeConfig();
  const nowMs = Date.now();
  if (!forceRefresh && cachedAiRuntimeConfig && nowMs - cachedAiRuntimeConfigLoadedAtMs < AI_RUNTIME_CONFIG_CACHE_MS) {
    return cachedAiRuntimeConfig;
  }

  try {
    const snap = await admin.firestore().collection(AI_RUNTIME_CONFIG_COLLECTION).doc(AI_RUNTIME_CONFIG_DOC).get();
    cachedAiRuntimeConfig = snap.exists ? mergeFirestoreAiRuntimeConfig(envConfig, snap.data() || {}) : envConfig;
  } catch (_error) {
    cachedAiRuntimeConfig = envConfig;
  }
  cachedAiRuntimeConfigLoadedAtMs = nowMs;
  return cachedAiRuntimeConfig;
}

function resetAiRuntimeConfigCache() {
  cachedAiRuntimeConfig = null;
  cachedAiRuntimeConfigLoadedAtMs = 0;
}

module.exports = {
  DEFAULT_OPENAI_MODEL,
  DEFAULT_VERTEX_GEMINI_PROVIDER,
  DEFAULT_VERTEX_API_VERSION,
  DEFAULT_AI_REQUEST_TIMEOUT_MS,
  DEFAULT_COST_PER_1K_TOKENS_USD,
  getAiRuntimeConfig,
  getEnvAiRuntimeConfig,
  resetAiRuntimeConfigCache,
};
