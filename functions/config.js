const firebaseAdmin = require('./firebaseAdmin');

const DEFAULT_VERTEX_GEMINI_PROVIDER = 'vertex-gemini';
const DEFAULT_VERTEX_GEMINI_MODEL = 'gemini-3.6-flash';
const DEFAULT_VERTEX_GEMINI_LOCATION = 'global';
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 30;
const DEFAULT_DAILY_TOKEN_LIMIT = 50000;
const DEFAULT_DAILY_BUDGET_USD = 5;
const DEFAULT_RESERVED_OUTPUT_TOKENS = 1200;
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

function hasExplicitVertexEnvConfig(env = process.env) {
  return [
    env.VERTEX_GEMINI_MODEL,
    env.LLM_MODEL,
    env.VERTEX_GEMINI_PROJECT,
    env.GOOGLE_CLOUD_PROJECT,
    env.GCLOUD_PROJECT,
    env.GCP_PROJECT,
    env.VERTEX_GEMINI_LOCATION,
    env.GOOGLE_CLOUD_LOCATION,
    env.VERTEX_GEMINI_INPUT_PER_1K_TOKENS_USD,
    env.VERTEX_GEMINI_CACHED_INPUT_PER_1K_TOKENS_USD,
    env.VERTEX_GEMINI_OUTPUT_PER_1K_TOKENS_USD,
    env.VERTEX_GEMINI_REASONING_TOKEN_TREATMENT,
    env.VERTEX_GEMINI_REASONING_PER_1K_TOKENS_USD,
  ].some((value) => getString(value, '') !== '');
}

function getOptionalNumber(value) {
  const candidate = typeof value === 'string' ? value.trim() : value;
  if (candidate === '' || candidate === undefined || candidate === null) return undefined;
  const parsed = Number(candidate);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildVertexGeminiProviderConfig(env = process.env) {
  return {
    provider: DEFAULT_VERTEX_GEMINI_PROVIDER,
    model: getString(env.VERTEX_GEMINI_MODEL || env.LLM_MODEL, DEFAULT_VERTEX_GEMINI_MODEL),
    project: getString(
      env.VERTEX_GEMINI_PROJECT
        || env.GOOGLE_CLOUD_PROJECT
        || env.GCLOUD_PROJECT
        || env.GCP_PROJECT,
      '',
    ),
    location: getString(env.VERTEX_GEMINI_LOCATION || env.GOOGLE_CLOUD_LOCATION, DEFAULT_VERTEX_GEMINI_LOCATION),
    apiVersion: getString(env.VERTEX_GEMINI_API_VERSION, DEFAULT_VERTEX_API_VERSION),
    timeoutMs: getPositiveNumber(env.VERTEX_GEMINI_TIMEOUT_MS || env.AI_REQUEST_TIMEOUT_MS, DEFAULT_AI_REQUEST_TIMEOUT_MS),
    pricing: {
      inputPer1kTokensUsd: getOptionalNumber(env.VERTEX_GEMINI_INPUT_PER_1K_TOKENS_USD),
      cachedInputPer1kTokensUsd: getOptionalNumber(env.VERTEX_GEMINI_CACHED_INPUT_PER_1K_TOKENS_USD),
      outputPer1kTokensUsd: getOptionalNumber(env.VERTEX_GEMINI_OUTPUT_PER_1K_TOKENS_USD),
      reasoningTokenTreatment: getString(env.VERTEX_GEMINI_REASONING_TOKEN_TREATMENT, ''),
      reasoningPer1kTokensUsd: getOptionalNumber(env.VERTEX_GEMINI_REASONING_PER_1K_TOKENS_USD),
    },
  };
}

function getEnvAiRuntimeConfig() {
  const vertexGemini = buildVertexGeminiProviderConfig();
  return {
    provider: DEFAULT_VERTEX_GEMINI_PROVIDER,
    model: vertexGemini.model,
    rateLimitWindowMs: getPositiveNumber(process.env.AI_RATE_LIMIT_WINDOW_MS, DEFAULT_RATE_LIMIT_WINDOW_MS),
    rateLimitMaxRequests: getPositiveNumber(process.env.AI_RATE_LIMIT_MAX_REQUESTS, DEFAULT_RATE_LIMIT_MAX_REQUESTS),
    dailyTokenLimit: getPositiveNumber(process.env.AI_DAILY_TOKEN_LIMIT, DEFAULT_DAILY_TOKEN_LIMIT),
    dailyBudgetUsd: getPositiveNumber(process.env.AI_DAILY_BUDGET_USD, DEFAULT_DAILY_BUDGET_USD),
    reservedOutputTokens: getPositiveNumber(process.env.AI_RESERVED_OUTPUT_TOKENS, DEFAULT_RESERVED_OUTPUT_TOKENS),
    providers: {
      [DEFAULT_VERTEX_GEMINI_PROVIDER]: vertexGemini,
    },
    source: hasExplicitVertexEnvConfig() ? 'env' : 'runtimeConfig/ai',
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
  const providerOverrides = getObject(data.providers);
  const providers = {
    [DEFAULT_VERTEX_GEMINI_PROVIDER]: mergeProviderConfig(
      base.providers?.[DEFAULT_VERTEX_GEMINI_PROVIDER],
      providerOverrides[DEFAULT_VERTEX_GEMINI_PROVIDER],
    ),
  };
  const provider = DEFAULT_VERTEX_GEMINI_PROVIDER;
  const providerDefaultModel = getString(providers[provider]?.model, '');

  return {
    provider,
    model: getString(data.model, providerDefaultModel || base.model),
    rateLimitWindowMs: getPositiveNumber(data.limits?.rateLimitWindowMs ?? data.rateLimitWindowMs, base.rateLimitWindowMs),
    rateLimitMaxRequests: getPositiveNumber(data.limits?.rateLimitMaxRequests ?? data.rateLimitMaxRequests, base.rateLimitMaxRequests),
    dailyTokenLimit: getPositiveNumber(data.limits?.dailyTokenLimit ?? data.dailyTokenLimit, base.dailyTokenLimit),
    dailyBudgetUsd: getPositiveNumber(data.limits?.dailyBudgetUsd ?? data.dailyBudgetUsd, base.dailyBudgetUsd),
    reservedOutputTokens: getPositiveNumber(data.limits?.reservedOutputTokens ?? data.reservedOutputTokens, base.reservedOutputTokens),
    providers,
    source: 'runtimeConfig/ai',
  };
}

async function getAiRuntimeConfig({ forceRefresh = false } = {}) {
  const envConfig = getEnvAiRuntimeConfig();
  const nowMs = Date.now();
  if (!forceRefresh && cachedAiRuntimeConfig && nowMs - cachedAiRuntimeConfigLoadedAtMs < AI_RUNTIME_CONFIG_CACHE_MS) {
    return cachedAiRuntimeConfig;
  }

  try {
    const snap = await firebaseAdmin.getAdminFirestore().collection(AI_RUNTIME_CONFIG_COLLECTION).doc(AI_RUNTIME_CONFIG_DOC).get();
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
  DEFAULT_VERTEX_GEMINI_PROVIDER,
  DEFAULT_VERTEX_GEMINI_MODEL,
  DEFAULT_VERTEX_GEMINI_LOCATION,
  DEFAULT_VERTEX_API_VERSION,
  DEFAULT_AI_REQUEST_TIMEOUT_MS,
  getAiRuntimeConfig,
  getEnvAiRuntimeConfig,
  hasExplicitVertexEnvConfig,
  resetAiRuntimeConfigCache,
};
