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

test('a late tenant A response cannot replace the committed tenant B response', async () => {
  const guard = createLatestRequestGuard();
  const committed = [];
  let resolveTenantA;
  const tenantAResponse = new Promise((resolve) => { resolveTenantA = resolve; });

  const tenantARequest = guard.begin();
  const tenantACommit = tenantAResponse.then((value) => {
    if (guard.isCurrent(tenantARequest)) committed.push(value);
  });

  guard.invalidate();
  const tenantBRequest = guard.begin();
  if (guard.isCurrent(tenantBRequest)) committed.push('tenant-b');

  resolveTenantA('tenant-a');
  await tenantACommit;

  assert.deepEqual(committed, ['tenant-b']);
});
