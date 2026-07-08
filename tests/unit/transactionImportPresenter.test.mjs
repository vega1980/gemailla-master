import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { runTransactionImport } from '../../src/features/erp/services/transactionImportPresenter.js';

function createHarness(overrides = {}) {
  const calls = [];
  return {
    calls,
    params: {
      rows: [{ amount: 10 }],
      companyId: 'company-1',
      fileName: 'transactions.csv',
      errors: [],
      importTransactions: async () => [{ id: 'tx-1' }],
      setImportedCount: (value) => calls.push(['setImportedCount', value]),
      setImporting: (value) => calls.push(['setImporting', value]),
      setStep: (value) => calls.push(['setStep', value]),
      toast: (value) => calls.push(['toast', value]),
      onSuccess: () => calls.push(['onSuccess']),
      ...overrides,
    },
  };
}

describe('transaction import presenter', () => {
  it('marca done, guarda conteo y ejecuta onSuccess cuando la importación funciona', async () => {
    const harness = createHarness({
      importTransactions: async (payload) => {
        harness.calls.push(['importTransactions', payload.importLog.status]);
        return [{ id: 'tx-1' }, { id: 'tx-2' }];
      },
    });

    await runTransactionImport(harness.params);

    assert.deepEqual(harness.calls, [
      ['setImporting', true],
      ['importTransactions', 'success'],
      ['setImportedCount', 2],
      ['setStep', 'done'],
      ['onSuccess'],
      ['setImporting', false],
    ]);
  });

  it('si falla vuelve a preview, muestra toast destructivo y siempre desbloquea sin registrar failed', async () => {
    const error = new Error('Firestore timeout después de crear algunas filas');
    let failureLogCalled = false;
    const harness = createHarness({
      importTransactions: async () => { throw error; },
      recordTransactionImportFailure: () => { failureLogCalled = true; },
    });

    await runTransactionImport(harness.params);

    assert.equal(failureLogCalled, false);
    assert.deepEqual(harness.calls, [
      ['setImporting', true],
      ['toast', {
        title: 'Error al importar transacciones',
        description: error.message,
        variant: 'destructive',
      }],
      ['setStep', 'preview'],
      ['setImporting', false],
    ]);
  });
});
