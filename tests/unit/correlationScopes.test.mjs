import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CorrelationScope, getScopedCorrelationId } from '../../src/lib/correlationScopes.js';

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
}

describe('correlation scopes', () => {
  it('generates page and request scoped IDs with explicit prefixes', () => {
    assert.match(getScopedCorrelationId(CorrelationScope.PAGE), /^page_/);
    assert.match(getScopedCorrelationId(CorrelationScope.REQUEST), /^request_/);
  });

  it('persists session scoped IDs in storage', () => {
    const storage = createMemoryStorage();
    const first = getScopedCorrelationId(CorrelationScope.SESSION, { storage });
    const second = getScopedCorrelationId(CorrelationScope.SESSION, { storage });

    assert.match(first, /^session_/);
    assert.equal(second, first);
  });

  it('uses the Firebase uid as the user scoped correlation id when provided', () => {
    assert.equal(getScopedCorrelationId(CorrelationScope.USER, { userId: ' user/123 ' }), 'user_123');
    assert.match(getScopedCorrelationId(CorrelationScope.USER), /^user_/);
  });
});
