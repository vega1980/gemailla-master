#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const FRONTEND_REQUIRED = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_FIREBASE_APPCHECK_SITE_KEY',
];

const BLOCKED_LOCAL_FUNCTIONS_VARIABLES = ['OPENAI_API_KEY', 'OPENAI_MODEL', 'VITE_OPENAI_API_KEY'];
const PLACEHOLDER_PATTERN = /^(TU_|YOUR_|CHANGEME|REPLACE_ME|xxx$|unknown$|local$)/i;

function parseArgs(argv) {
  const options = { target: process.env.GEMAILLA_VALIDATE_ENV_TARGET || 'frontend' };
  for (const arg of argv) {
    if (arg.startsWith('--target=')) options.target = arg.slice('--target='.length);
    if (arg === '--all') options.target = 'all';
    if (arg === '--functions') options.target = 'functions';
    if (arg === '--frontend') options.target = 'frontend';
  }
  return options;
}

function readDotEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const values = {};
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    values[key] = rawValue.replace(/^['"]|['"]$/g, '').trim();
  }
  return values;
}

function collectEnvironment() {
  return {
    ...readDotEnvFile(resolve('.env')),
    ...readDotEnvFile(resolve('.env.local')),
    ...process.env,
  };
}

function isPresent(value) {
  return typeof value === 'string' && value.trim().length > 0 && !PLACEHOLDER_PATTERN.test(value.trim());
}

function validateRequired(env, names) {
  return names.filter((name) => !isPresent(env[name]));
}

function hasExplicitVertexEnvConfig(env) {
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
  ].some((value) => isPresent(value));
}

function getFunctionsConfigSource(env) {
  return hasExplicitVertexEnvConfig(env) ? 'env' : 'runtimeConfig/ai';
}

function getFunctionsRequiredNames(env) {
  if (getFunctionsConfigSource(env) !== 'env') return [];

  const required = [
    'VERTEX_GEMINI_MODEL',
    'VERTEX_GEMINI_LOCATION',
    'VERTEX_GEMINI_INPUT_PER_1K_TOKENS_USD',
    'VERTEX_GEMINI_CACHED_INPUT_PER_1K_TOKENS_USD',
    'VERTEX_GEMINI_OUTPUT_PER_1K_TOKENS_USD',
    'VERTEX_GEMINI_REASONING_TOKEN_TREATMENT',
  ];

  if (!isPresent(env.VERTEX_GEMINI_PROJECT)
    && !isPresent(env.GOOGLE_CLOUD_PROJECT)
    && !isPresent(env.GCLOUD_PROJECT)
    && !isPresent(env.GCP_PROJECT)) {
    required.push('VERTEX_GEMINI_PROJECT');
  }

  if (String(env.VERTEX_GEMINI_REASONING_TOKEN_TREATMENT || '').trim().toLowerCase() === 'billable') {
    required.push('VERTEX_GEMINI_REASONING_PER_1K_TOKENS_USD');
  }

  return required;
}

function validateBlockedLocalFunctionsVariables(env) {
  return BLOCKED_LOCAL_FUNCTIONS_VARIABLES.filter((name) => isPresent(env[name]));
}

function getRequiredNames(target, env) {
  if (target === 'frontend') return FRONTEND_REQUIRED;
  if (target === 'functions') return getFunctionsRequiredNames(env);
  if (target === 'all') return [...FRONTEND_REQUIRED, ...getFunctionsRequiredNames(env)];
  throw new Error(`Target no soportado: ${target}. Usa frontend, functions o all.`);
}

function validateEnvironment({ target, env }) {
  const blockedLocalVariables = validateBlockedLocalFunctionsVariables(env);
  if (blockedLocalVariables.length > 0) {
    return {
      ok: false,
      reason: 'blocked',
      blockedLocalVariables,
      source: getFunctionsConfigSource(env),
      messages: [
        '❌ Validación de entorno fallida. Existen configuraciones locales activas no permitidas:',
        ...blockedLocalVariables.map((name) => `  - ${name}`),
        '',
        'El backend debe usar Vertex AI con ADC desde Firebase Functions; no se admiten claves o modelos locales de OpenAI.',
      ],
    };
  }

  const requiredNames = getRequiredNames(target, env);
  const missing = validateRequired(env, requiredNames);
  if (missing.length > 0) {
    return {
      ok: false,
      reason: 'missing',
      missing,
      source: getFunctionsConfigSource(env),
      messages: [
        '❌ Validación de entorno fallida. Faltan variables obligatorias o contienen placeholders:',
        ...missing.map((name) => `  - ${name}`),
        '',
        'Configura las variables en el entorno de CI, .env o .env.local antes de ejecutar builds/pruebas.',
      ],
    };
  }

  return {
    ok: true,
    source: getFunctionsConfigSource(env),
    messages: [`✅ Entorno validado sin prompts interactivos (target: ${target}, functions source: ${getFunctionsConfigSource(env)}).`],
  };
}

function printValidationResult(result) {
  for (const message of result.messages) {
    if (message.startsWith('✅')) console.log(message);
    else console.error(message);
  }
}

function main() {
  const { target } = parseArgs(process.argv.slice(2));
  const env = collectEnvironment();
  const result = validateEnvironment({ target, env });
  printValidationResult(result);
  if (!result.ok) process.exit(1);
}

const isMainModule = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMainModule) {
  main();
}

export {
  BLOCKED_LOCAL_FUNCTIONS_VARIABLES,
  FRONTEND_REQUIRED,
  collectEnvironment,
  getFunctionsConfigSource,
  getFunctionsRequiredNames,
  getRequiredNames,
  hasExplicitVertexEnvConfig,
  isPresent,
  parseArgs,
  validateEnvironment,
  validateRequired,
};
