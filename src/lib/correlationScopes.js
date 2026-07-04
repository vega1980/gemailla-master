import { createCorrelationId, ensureCorrelationId } from './observabilityPolicy.js';

const SESSION_CORRELATION_STORAGE_KEY = 'gemailla:correlation:session';

export const CorrelationScope = Object.freeze({
  PAGE: 'page',
  SESSION: 'session',
  REQUEST: 'request',
  USER: 'user',
});

function getStorage(storage = globalThis.window?.localStorage) {
  return storage || null;
}

function getOrCreateSessionId(storage) {
  const scopedStorage = getStorage(storage);
  if (!scopedStorage) return createCorrelationId(CorrelationScope.SESSION);

  const existingSessionId = scopedStorage.getItem(SESSION_CORRELATION_STORAGE_KEY);
  const sessionId = ensureCorrelationId(existingSessionId, CorrelationScope.SESSION);
  scopedStorage.setItem(SESSION_CORRELATION_STORAGE_KEY, sessionId);
  return sessionId;
}

function getUserCorrelationId(userId) {
  return userId
    ? ensureCorrelationId(userId, CorrelationScope.USER)
    : createCorrelationId(CorrelationScope.USER);
}

export function getScopedCorrelationId(scope = CorrelationScope.REQUEST, options = {}) {
  switch (scope) {
    case CorrelationScope.SESSION:
      return getOrCreateSessionId(options.storage);
    case CorrelationScope.USER:
      return getUserCorrelationId(options.userId);
    case CorrelationScope.PAGE:
      return createCorrelationId(CorrelationScope.PAGE);
    case CorrelationScope.REQUEST:
    default:
      return createCorrelationId(CorrelationScope.REQUEST);
  }
}
