import { auth, db } from '@/firebase';
import { addDoc, collection } from 'firebase/firestore';

const FALLBACK_APP_VERSION = '1.0.0';
const runtimeMetadata = typeof window !== 'undefined' ? window.GEMAILLA_RELEASE || {} : {};
const MAX_CORRELATION_ID_LENGTH = 160;
const MAX_LOG_STRING_LENGTH = 500;
const MAX_LOG_DEPTH = 5;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const TOKEN_PATTERN = /(bearer\s+|token['"\s:=]+|api[_-]?key['"\s:=]+|secret['"\s:=]+)[A-Za-z0-9._~+/=-]{12,}/gi;
const SENSITIVE_KEY_PATTERN = /(authorization|api[_-]?key|secret|token|password|prompt|content|document(Content|Text)?|raw(Document)?|file(Name)?|storagePath|downloadUrl|url|query|response|rfc|email)$/i;
const ERROR_REDACT_KEY_ALLOWLIST = new Set(['name', 'message', 'stack']);

export const releaseMetadata = Object.freeze({
  appVersion: import.meta.env.VITE_APP_VERSION || runtimeMetadata.APP_VERSION || __APP_VERSION__ || FALLBACK_APP_VERSION,
  buildId: import.meta.env.VITE_BUILD_ID || runtimeMetadata.BUILD_ID || __BUILD_ID__ || 'local',
  gitSha: import.meta.env.VITE_GIT_SHA || runtimeMetadata.GIT_SHA || __GIT_SHA__ || 'unknown',
  deployEnv: import.meta.env.VITE_DEPLOY_ENV || runtimeMetadata.DEPLOY_ENV || __DEPLOY_ENV__ || 'development',
});

export function createCorrelationId(prefix = 'op') {
  const randomValue = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${randomValue}`;
}

function normalizeCorrelationId(value, prefix = 'op') {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (!candidate) return createCorrelationId(prefix);

  const safeValue = candidate
    .replace(/[^a-zA-Z0-9._:-]/g, '_')
    .slice(0, MAX_CORRELATION_ID_LENGTH);

  return safeValue || createCorrelationId(prefix);
}

export function ensureCorrelationId(value, prefix = 'op') {
  return normalizeCorrelationId(value, prefix);
}

export function getReleaseMetadata() {
  return releaseMetadata;
}

function redactString(value) {
  return value
    .replace(EMAIL_PATTERN, '[REDACTED_EMAIL]')
    .replace(TOKEN_PATTERN, '$1[REDACTED_SECRET]')
    .slice(0, MAX_LOG_STRING_LENGTH);
}

function shouldRedactKey(key) {
  return SENSITIVE_KEY_PATTERN.test(key);
}

export function sanitizeObservabilityPayload(value, depth = 0, key = '') {
  if (value === null || value === undefined) return value;
  if (depth > MAX_LOG_DEPTH) return '[MAX_DEPTH]';

  if (typeof value === 'string') {
    if (shouldRedactKey(key)) return value ? '[REDACTED]' : '';
    return redactString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeObservabilityPayload(item, depth + 1, key));

  if (typeof value === 'object') {
    const sanitized = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
      if (shouldRedactKey(entryKey) && !(key === 'error' && ERROR_REDACT_KEY_ALLOWLIST.has(entryKey))) {
        sanitized[entryKey] = entryValue ? '[REDACTED]' : entryValue;
        continue;
      }
      sanitized[entryKey] = sanitizeObservabilityPayload(entryValue, depth + 1, entryKey);
    }
    return sanitized;
  }

  return String(value);
}

function getErrorPayload(error) {
  if (error instanceof Error) {
    return sanitizeObservabilityPayload({
      name: error.name,
      message: error.message,
      stack: error.stack || '',
    }, 0, 'error');
  }

  return sanitizeObservabilityPayload({
    name: 'NonError',
    message: typeof error === 'string' ? error : JSON.stringify(error),
    stack: '',
  }, 0, 'error');
}

function writeConsole(level, eventName, payload = {}) {
  const entry = sanitizeObservabilityPayload({
    severity: level.toUpperCase(),
    eventName,
    timestamp: new Date().toISOString(),
    ...releaseMetadata,
    ...payload,
  });

  if (level === 'error') console.error(JSON.stringify(entry));
  else if (level === 'warn') console.warn(JSON.stringify(entry));
  else console.info(JSON.stringify(entry));
}

export function logFrontendEvent(eventName, payload = {}, level = 'info') {
  writeConsole(level, eventName, payload);
}

export async function persistObservabilityEvent(eventName, payload = {}) {
  const user = auth.currentUser || null;
  const normalizedPayload = sanitizeObservabilityPayload({
    eventName,
    ...releaseMetadata,
    ...payload,
    ownerUid: payload.ownerUid || user?.uid || '',
    createdAt: new Date().toISOString(),
  });

  if (!normalizedPayload.ownerUid && !payload.companyId) return null;
  return addDoc(collection(db, 'observabilityEvents'), normalizedPayload);
}

export async function captureFrontendError(error, context = {}) {
  const correlationId = ensureCorrelationId(context.correlationId, 'fe');
  const payload = {
    correlationId,
    severity: context.severity || 'ERROR',
    source: 'frontend',
    error: getErrorPayload(error),
    route: typeof window !== 'undefined' ? window.location.pathname : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    context: context.context || {},
  };

  logFrontendEvent('frontend_error', payload, 'error');
  await persistObservabilityEvent('frontend_error', payload).catch(() => null);
  return correlationId;
}

export function installGlobalErrorTracking() {
  if (typeof window === 'undefined' || window.__GEMAILLA_ERROR_TRACKING__) return;
  window.__GEMAILLA_ERROR_TRACKING__ = true;

  window.addEventListener('error', (event) => {
    captureFrontendError(event.error || event.message, {
      context: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    captureFrontendError(event.reason, {
      context: { type: 'unhandledrejection' },
    });
  });
}
