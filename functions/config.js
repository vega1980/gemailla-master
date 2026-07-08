const admin = require('firebase-admin');
const { validateFunctionsEnv } = require('./env');

const DEFAULT_LLM_PROVIDER = 'openai';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 30;
const DEFAULT_DAILY_TOKEN_LIMIT = 50000;
const DEFAULT_DAILY_BUDGET_USD = 5;
const DEFAULT_RESERVED_OUTPUT_TOKENS = 1200;
const DEFAULT_COST_PER_1K_TOKENS_USD = 0.002;
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

function getEnvAiRuntimeConfig() {
  const env = validateFunctionsEnv();
  const provider = getString(env.LLM_PROVIDER, DEFAULT_LLM_PROVIDER).toLowerCase();
  const model = getString(env.LLM_MODEL || env.OPENAI_MODEL, provider === 'openai' ? DEFAULT_OPENAI_MODEL : 'default');
  return {
    provider,
    model,
    rateLimitWindowMs: getPositiveNumber(env.AI_RATE_LIMIT_WINDOW_MS, DEFAULT_RATE_LIMIT_WINDOW_MS),
    rateLimitMaxRequests: getPositiveNumber(env.AI_RATE_LIMIT_MAX_REQUESTS, DEFAULT_RATE_LIMIT_MAX_REQUESTS),
    dailyTokenLimit: getPositiveNumber(env.AI_DAILY_TOKEN_LIMIT, DEFAULT_DAILY_TOKEN_LIMIT),
    dailyBudgetUsd: getPositiveNumber(env.AI_DAILY_BUDGET_USD, DEFAULT_DAILY_BUDGET_USD),
    reservedOutputTokens: getPositiveNumber(env.AI_RESERVED_OUTPUT_TOKENS, DEFAULT_RESERVED_OUTPUT_TOKENS),
    costPer1kTokensUsd: getPositiveNumber(env.AI_COST_PER_1K_TOKENS_USD, DEFAULT_COST_PER_1K_TOKENS_USD),
    source: 'env',
  };
}

function mergeFirestoreAiRuntimeConfig(base, data = {}) {
  const pricing = data.pricing && typeof data.pricing === 'object' ? data.pricing : {};
  const limits = data.limits && typeof data.limits === 'object' ? data.limits : {};
  return {
    provider: getString(data.provider, base.provider).toLowerCase(),
    model: getString(data.model, base.model),
    rateLimitWindowMs: getPositiveNumber(limits.rateLimitWindowMs ?? data.rateLimitWindowMs, base.rateLimitWindowMs),
    rateLimitMaxRequests: getPositiveNumber(limits.rateLimitMaxRequests ?? data.rateLimitMaxRequests, base.rateLimitMaxRequests),
    dailyTokenLimit: getPositiveNumber(limits.dailyTokenLimit ?? data.dailyTokenLimit, base.dailyTokenLimit),
    dailyBudgetUsd: getPositiveNumber(limits.dailyBudgetUsd ?? data.dailyBudgetUsd, base.dailyBudgetUsd),
    reservedOutputTokens: getPositiveNumber(limits.reservedOutputTokens ?? data.reservedOutputTokens, base.reservedOutputTokens),
    costPer1kTokensUsd: getPositiveNumber(pricing.costPer1kTokensUsd ?? data.costPer1kTokensUsd, base.costPer1kTokensUsd),
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
  DEFAULT_COST_PER_1K_TOKENS_USD,
  getAiRuntimeConfig,
  getEnvAiRuntimeConfig,
  resetAiRuntimeConfigCache,
};
