import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const repoRoot = new URL('../..', import.meta.url);
const protectedRoute = readFileSync(new URL('src/components/auth/ProtectedRoute.jsx', repoRoot), 'utf8');
const provider = readFileSync(new URL('src/lib/subscriptionContext.jsx', repoRoot), 'utf8');

test('SubscriptionProvider is nested inside CompanyProvider', () => {
  const companyStart = protectedRoute.indexOf('<CompanyProvider>');
  const subscriptionStart = protectedRoute.indexOf('<SubscriptionProvider>');
  const subscriptionEnd = protectedRoute.indexOf('</SubscriptionProvider>');
  const companyEnd = protectedRoute.indexOf('</CompanyProvider>');

  assert.ok(companyStart >= 0);
  assert.ok(companyStart < subscriptionStart);
  assert.ok(subscriptionStart < subscriptionEnd);
  assert.ok(subscriptionEnd < companyEnd);
});

test('subscription authority is the active company entitlement and never a user subscription', () => {
  assert.match(provider, /const \{ activeCompany \} = useCompany\(\)/);
  assert.match(provider, /loadCompanyEntitlement\(firebase\.entities, \{\s*companyId,/);
  assert.doesNotMatch(provider, /loadActiveSubscriptions/);
  assert.doesNotMatch(provider, /subs\[0\]/);
});

test('tenant and identity changes purge entitlement before paint and invalidate stale requests', () => {
  assert.match(provider, /useLayoutEffect\(\(\) => \{/);
  assert.match(provider, /requestGuardRef\.current\.invalidate\(\);/);
  assert.match(provider, /setSubscription\(null\);/);
  assert.match(provider, /setLoading\(Boolean\(companyId\)\);/);
  assert.match(provider, /sessionIdRef\.current !== requestSessionId/);
  assert.match(provider, /requestGuardRef\.current\.isCurrent\(requestToken\)/);
});

test('plan and AI decisions use the validated entitlement helpers', () => {
  assert.match(provider, /isCompanyEntitlementActive\(subscription\)/);
  assert.match(provider, /canCompanyEntitlementAccessAI\(subscription\)/);
});

test('prediction writes compare the same identity and tenant session key', () => {
  assert.match(provider, /const requestSessionId = tenantSessionId;/);
  assert.match(provider, /sessionIdRef\.current !== requestSessionId/);
});
