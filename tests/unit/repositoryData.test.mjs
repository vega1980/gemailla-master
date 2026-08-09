import test from 'node:test';
import assert from 'node:assert/strict';
import { Timestamp } from 'firebase/firestore';
import { serializeRepositoryData, stripRepositoryDocumentId } from '../../src/infrastructure/firebase/repositories/repositoryData.js';

test('convierte timestamps de Firestore al formato esperado por la interfaz', () => {
  const timestamp = Timestamp.fromDate(new Date('2026-08-09T12:00:00.000Z'));
  assert.deepEqual(serializeRepositoryData({ createdAt: timestamp, name: 'Ticket' }), { createdAt: '2026-08-09T12:00:00.000Z', name: 'Ticket' });
});

test('retira id del payload sin modificar el objeto original', () => {
  const input = { id: 'document-path-id', name: 'Cliente' };
  assert.deepEqual(stripRepositoryDocumentId(input), { name: 'Cliente' });
  assert.deepEqual(input, { id: 'document-path-id', name: 'Cliente' });
});
