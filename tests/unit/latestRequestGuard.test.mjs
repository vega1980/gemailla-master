import assert from 'node:assert/strict';
import test from 'node:test';

import { createLatestRequestGuard } from '../../src/lib/latestRequestGuard.js';

test('concurrent loads allow only the latest asynchronous request to commit state', () => {
  const guard = createLatestRequestGuard();
  const slowRequest = guard.begin();
  const latestRequest = guard.begin();

  assert.equal(guard.isCurrent(slowRequest), false);
  assert.equal(guard.isCurrent(latestRequest), true);
});

test('changing users invalidates the previous session request', () => {
  const guard = createLatestRequestGuard();
  const oldSessionRequest = guard.begin();

  guard.invalidate();

  assert.equal(guard.isCurrent(oldSessionRequest), false);
});
