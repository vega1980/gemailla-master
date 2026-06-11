const admin = require('firebase-admin');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

admin.initializeApp();

const openAiApiKey = defineSecret('OPENAI_API_KEY');
const DEFAULT_MODEL = 'gpt-4o-mini';
const MAX_PROMPT_LENGTH = 12000;
const RELEASE_METADATA = Object.freeze({
  appVersion: process.env.APP_VERSION || '1.0.0',
  buildId: process.env.BUILD_ID || process.env.K_REVISION || 'local',
  gitSha: process.env.GIT_SHA || process.env.GITHUB_SHA || 'unknown',
  deployEnv: process.env.DEPLOY_ENV || process.env.NODE_ENV || 'production',
});

function createCorrelationId(prefix = 'srv') {
  const crypto = require('node:crypto');
  return `${prefix}_${crypto.randomUUID()}`;
}

function getCorrelationId(req) {
  const headerValue = req.get('x-correlation-id');
  const bodyValue = req.body?.correlationId;
  return String(headerValue || bodyValue || createCorrelationId('ai')).trim();
}

function structuredLog(severity, eventName, payload = {}) {
  const entry = {
    severity,
    eventName,
    timestamp: new Date().toISOString(),
    ...RELEASE_METADATA,
    ...payload,
  };
  const line = JSON.stringify(entry);
  if (severity === 'ERROR' || severity === 'CRITICAL') console.error(line);
  else if (severity === 'WARNING') console.warn(line);
  else console.log(line);
}

function getAllowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function applyCors(req, res) {
  const allowedOrigins = getAllowedOrigins();
  const requestOrigin = req.get('origin');
  const allowedOrigin = allowedOrigins.includes(requestOrigin)
    ? requestOrigin
    : allowedOrigins[0] || requestOrigin || '*';

  res.set('Access-Control-Allow-Origin', allowedOrigin);
  res.set('Vary', 'Origin');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Correlation-Id');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

function getBearerToken(req) {
  const authHeader = req.get('authorization') || '';
  const [scheme, token] = authHeader.split(' ');
  return scheme?.toLowerCase() === 'bearer' ? token : null;
}

async function verifyFirebaseUser(req) {
  if (process.env.ALLOW_UNAUTHENTICATED_AI === 'true') {
    return { uid: 'local-dev', email: 'local-dev@gemailla.local' };
  }

  const token = getBearerToken(req);
  if (!token) {
    const error = new Error('Autenticación requerida para usar IA.');
    error.status = 401;
    throw error;
  }

  try {
    return await admin.auth().verifyIdToken(token);
  } catch (_error) {
    const error = new Error('Token de Firebase inválido o expirado.');
    error.status = 401;
    throw error;
  }
}

function getPrompt(body = {}) {
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) {
    const error = new Error('El campo prompt es obligatorio.');
    error.status = 400;
    throw error;
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    const error = new Error(`El prompt excede el límite de ${MAX_PROMPT_LENGTH} caracteres.`);
    error.status = 413;
    throw error;
  }

  return prompt;
}

function extractOutputText(payload = {}) {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const chunks = [];
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) chunks.push(content.text);
    }
  }

  return chunks.join('\n').trim();
}

async function callOpenAI({ apiKey, prompt, user, correlationId }) {
  const startedAt = Date.now();
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Correlation-Id': correlationId,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
      input: [
        {
          role: 'system',
          content: 'Eres GEMAILLA AI, un asistente financiero empresarial. Responde en español, con recomendaciones accionables y sin inventar datos no presentes en el contexto.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      metadata: {
        firebase_uid: user.uid || 'unknown',
        correlation_id: correlationId,
        app_version: RELEASE_METADATA.appVersion,
        build_id: RELEASE_METADATA.buildId,
        git_sha: RELEASE_METADATA.gitSha,
        deploy_env: RELEASE_METADATA.deployEnv,
      },
    }),
  });

  const latencyMs = Date.now() - startedAt;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    structuredLog('ERROR', 'openai_request_failed', {
      correlationId,
      firebaseUid: user.uid || 'unknown',
      status: response.status,
      latencyMs,
      message: payload?.error?.message || payload?.message || 'OpenAI error',
    });
    const message = payload?.error?.message || payload?.message || `OpenAI respondió HTTP ${response.status}.`;
    const error = new Error(message);
    error.status = response.status >= 500 ? 502 : response.status;
    throw error;
  }

  const outputText = extractOutputText(payload);
  if (!outputText) {
    const error = new Error('OpenAI no devolvió texto utilizable.');
    error.status = 502;
    throw error;
  }

  structuredLog('INFO', 'openai_request_completed', {
    correlationId,
    firebaseUid: user.uid || 'unknown',
    status: response.status,
    latencyMs,
    model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
  });

  return { outputText, latencyMs };
}

exports.ai = onRequest({ cors: false, secrets: [openAiApiKey] }, async (req, res) => {
  const startedAt = Date.now();
  const correlationId = getCorrelationId(req);
  applyCors(req, res);
  res.set('X-Correlation-Id', correlationId);
  res.set('X-App-Version', RELEASE_METADATA.appVersion);
  res.set('X-Build-Id', RELEASE_METADATA.buildId);
  res.set('X-Git-Sha', RELEASE_METADATA.gitSha);
  res.set('X-Deploy-Env', RELEASE_METADATA.deployEnv);

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    structuredLog('WARNING', 'ai_request_rejected', { correlationId, method: req.method, status: 405 });
    res.status(405).json({ error: 'Método no permitido. Usa POST.', correlationId, release: RELEASE_METADATA });
    return;
  }

  try {
    const apiKey = openAiApiKey.value() || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      structuredLog('ERROR', 'ai_backend_not_configured', { correlationId, status: 503 });
      res.status(503).json({
        error: 'Backend IA no configurado: falta OPENAI_API_KEY en Firebase Functions.',
        correlationId,
        release: RELEASE_METADATA,
      });
      return;
    }

    const user = await verifyFirebaseUser(req);
    const prompt = getPrompt(req.body);
    structuredLog('INFO', 'ai_request_started', {
      correlationId,
      firebaseUid: user.uid || 'unknown',
      promptLength: prompt.length,
      model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
    });

    const { outputText } = await callOpenAI({ apiKey, prompt, user, correlationId });

    res.status(200).json({
      response: outputText,
      model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
      status: 'completed',
      correlationId,
      release: RELEASE_METADATA,
    });

    structuredLog('INFO', 'ai_request_completed', {
      correlationId,
      firebaseUid: user.uid || 'unknown',
      status: 200,
      latencyMs: Date.now() - startedAt,
    });
  } catch (error) {
    const status = Number(error.status) || 500;
    structuredLog(status >= 500 ? 'ERROR' : 'WARNING', 'ai_request_failed', {
      correlationId,
      status,
      latencyMs: Date.now() - startedAt,
      message: error.message || 'No se pudo completar la consulta de IA.',
    });
    res.status(status).json({
      error: error.message || 'No se pudo completar la consulta de IA.',
      correlationId,
      release: RELEASE_METADATA,
    });
  }
});
