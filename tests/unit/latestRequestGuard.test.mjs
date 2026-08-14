import assert from 'node:assert/strict';
import test from 'node:test';

import { createLatestRequestGuard } from '../../src/lib/latestRequestGuard.js';

test('only the latest asynchronous request may commit state', () => {
  const guard = createLatestRequestGuard();
  const slowRequest = guard.begin();
  const latestRequest = guard.begin();

  assert.equal(guard.isCurrent(slowRequest), false);
  assert.equal(guard.isCurrent(latestRequest), true);
});

test('invalidating a guard prevents an old session from committing state', () => {
  const guard = createLatestRequestGuard();
  const oldSessionRequest = guard.begin();

  guard.invalidate();

  assert.equal(guard.isCurrent(oldSessionRequest), false);
});
