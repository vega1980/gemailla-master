import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { sanitizeEntitlement } from '../../scripts/backfill-company-entitlements.mjs';

describe('company entitlement backfill sanitizer', () => {
  it('preserves explicit aiAccess=false even for paid plans', () => {
    const entitlement = sanitizeEntitlement({
      companyId: 'company-pro-disabled',
      subscription: {
        plan: 'pro',
        status: 'active',
        aiAccess: false,
        currentPeriodEnd: '2999-01-01T00:00:00.000Z',
      },
    });

    assert.equal(entitlement.plan, 'pro');
    assert.equal(entitlement.aiAccess, false);
  });

  it('infers aiAccess from plan only when legacy subscriptions omit it', () => {
    const proEntitlement = sanitizeEntitlement({
      companyId: 'company-pro-legacy',
      subscription: {
        plan: 'pro',
        status: 'active',
        currentPeriodEnd: '2999-01-01T00:00:00.000Z',
      },
    });
    const basicEntitlement = sanitizeEntitlement({
      companyId: 'company-basic-legacy',
      subscription: {
        plan: 'basic',
        status: 'active',
        currentPeriodEnd: '2999-01-01T00:00:00.000Z',
      },
    });

    assert.equal(proEntitlement.aiAccess, true);
    assert.equal(basicEntitlement.aiAccess, false);
  });
});
