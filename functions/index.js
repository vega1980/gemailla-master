const admin = require('firebase-admin');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

admin.initializeApp();

const openAiApiKey = defineSecret('OPENAI_API_KEY');
const DEFAULT_MODEL = 'gpt-4o-mini';
const MAX_PROMPT_LENGTH = 12000;

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
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

async function callOpenAI({ apiKey, prompt, user }) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
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
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
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

  return outputText;
}

exports.ai = onRequest({ cors: false, secrets: [openAiApiKey] }, async (req, res) => {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido. Usa POST.' });
    return;
  }

  try {
    const apiKey = openAiApiKey.value() || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: 'Backend IA no configurado: falta OPENAI_API_KEY en Firebase Functions.' });
      return;
    }

    const user = await verifyFirebaseUser(req);
    const prompt = getPrompt(req.body);
    const answer = await callOpenAI({ apiKey, prompt, user });

    res.status(200).json({
      response: answer,
      model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
      status: 'completed',
    });
  } catch (error) {
    const status = Number(error.status) || 500;
    res.status(status).json({ error: error.message || 'No se pudo completar la consulta de IA.' });
  }
});
