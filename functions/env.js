const { z } = require('zod');

const positiveNumberFromEnv = z.coerce.number().positive();

const functionsEnvSchema = z.object({
  OPENAI_API_KEY: z.string().trim().min(1).optional(),
  ALLOWED_ORIGINS: z.string().trim().optional(),
  LLM_PROVIDER: z.enum(['openai']).optional(),
  LLM_MODEL: z.string().trim().min(1).optional(),
  OPENAI_MODEL: z.string().trim().min(1).optional(),
  AI_RATE_LIMIT_WINDOW_MS: positiveNumberFromEnv.optional(),
  AI_RATE_LIMIT_MAX_REQUESTS: positiveNumberFromEnv.optional(),
  AI_DAILY_TOKEN_LIMIT: positiveNumberFromEnv.optional(),
  AI_DAILY_BUDGET_USD: positiveNumberFromEnv.optional(),
  AI_RESERVED_OUTPUT_TOKENS: positiveNumberFromEnv.optional(),
  AI_COST_PER_1K_TOKENS_USD: positiveNumberFromEnv.optional(),
  AI_REQUEST_TIMEOUT_MS: positiveNumberFromEnv.optional(),
  AI_DOCUMENT_CONTEXT_MAX_BYTES: positiveNumberFromEnv.optional(),
  AI_DOCUMENT_CONTEXT_MAX_CHARS: positiveNumberFromEnv.optional(),
  AI_DOCUMENT_CONTEXT_MAX_TOTAL_CHARS: positiveNumberFromEnv.optional(),
  DOCUMENT_SUCCESSFUL_STATUSES: z.string().trim().optional(),
  ORPHAN_DOCUMENT_CLEANUP_DRY_RUN: z.enum(['true', 'false', '']).optional(),
  ORPHAN_DOCUMENT_CLEANUP_MAX_FILES: positiveNumberFromEnv.optional(),
  APP_VERSION: z.string().trim().optional(),
  BUILD_ID: z.string().trim().optional(),
  GIT_SHA: z.string().trim().optional(),
  DEPLOY_ENV: z.enum(['development', 'staging', 'production', 'test']).optional(),
  NODE_ENV: z.string().trim().optional(),
  K_REVISION: z.string().trim().optional(),
  GITHUB_SHA: z.string().trim().optional(),
}).passthrough();

function validateFunctionsEnv(env = process.env) {
  const result = functionsEnvSchema.safeParse(env || {});
  if (!result.success) {
    const details = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Variables de entorno de Cloud Functions inválidas: ${details}`);
  }
  return result.data;
}

module.exports = { functionsEnvSchema, validateFunctionsEnv };
