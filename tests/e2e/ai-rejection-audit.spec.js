import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { clearFirebaseEmulators, getE2EProjectId } from './support/emulatorCleanup.js';
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

test('anonymous AI rejection is persisted by real Functions and Firestore emulators', async ({ request, baseURL }) => {
  await clearFirebaseEmulators();
  const response = await request.post('/api/ai', {
    headers: { Origin: new URL(baseURL).origin }, data: { prompt: 'Verificación de rechazo sin datos personales.' },
  });
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.correlationId).toBeTruthy();
  const app = initializeApp({ projectId: getE2EProjectId() }, 'audit-rejection-check');
  try {
    const events = await getFirestore(app).collection('aiAuditLogs').where('correlationId', '==', body.correlationId).get();
    expect(events.empty).toBe(false);
    for (const event of events.docs) {
      expect(Object.hasOwn(event.data(), 'estimatedTokens')).toBe(false);
      expect(Object.hasOwn(event.data(), 'estimatedCostUsd')).toBe(false);
    }
  } finally { await deleteApp(app); }
});
