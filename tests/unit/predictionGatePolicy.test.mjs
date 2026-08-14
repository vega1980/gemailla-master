import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getPredictionGateStatus,
  PredictionGateStatus,
} from '../../src/features/subscription/components/predictionGatePolicy.js';

test('blocks prediction content when quota usage is not available', () => {
  assert.equal(getPredictionGateStatus({
    loading: false,
    hasRequiredPlan: true,
    predictionCountAvailable: false,
    isAtLimit: false,
  }), PredictionGateStatus.QUOTA_UNAVAILABLE);
});

test('allows prediction content only with plan and verified remaining quota', () => {
  assert.equal(getPredictionGateStatus({
    loading: false,
    hasRequiredPlan: true,
    predictionCountAvailable: true,
    isAtLimit: false,
  }), PredictionGateStatus.ALLOWED);
});
