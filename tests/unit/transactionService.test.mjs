import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  calculateTransactionTotals,
  createTransactionService,
  normalizeTransactionDraft,
} from '../../src/domain/finance/transactionService.js';

describe('transaction domain service', () => {
  it('normaliza borradores y exige companyId antes de tocar infraestructura', () => {
    assert.deepEqual(normalizeTransactionDraft({ type: 'gasto', amount: '12.50' }, 'company-1'), {
      type: 'gasto',
      amount: 12.5,
      companyId: 'company-1',
      status: 'confirmed',
    });

    assert.throws(() => normalizeTransactionDraft({ amount: 10 }, ''), /companyId es obligatorio/);
    assert.throws(() => normalizeTransactionDraft({ amount: 0 }, 'company-1'), /mayor a cero/);
  });

  it('ejecuta casos de uso con repositorios inyectados, sin depender de Firebase', async () => {
    const createdRows = [];
    const importLogs = [];
    const service = createTransactionService({
      transactions: {
        create: async (data) => ({ id: 'tx-1', ...data }),
        bulkCreate: async (rows) => {
          createdRows.push(...rows);
          return rows.map((row, index) => ({ id: `tx-${index + 1}`, ...row }));
        },
        archive: async (id) => ({ id, status: 'archived' }),
      },
      importLogs: {
        create: async (data) => {
          importLogs.push(data);
          return data;
        },
      },
    });

    const created = await service.bulkImport({
      companyId: 'company-1',
      rows: [{ type: 'ingreso', amount: '100' }, { type: 'gasto', amount: 40 }],
      importLog: { status: 'partial', errorCount: 1 },
    });

    assert.equal(created.length, 2);
    assert.deepEqual(createdRows.map((row) => row.companyId), ['company-1', 'company-1']);
    assert.deepEqual(importLogs[0], {
      status: 'partial',
      errorCount: 1,
      companyId: 'company-1',
      type: 'transactions',
      validCount: 2,
    });
  });

  it('calcula totales como regla pura de dominio', () => {
    assert.deepEqual(calculateTransactionTotals([
      { type: 'ingreso', amount: 100 },
      { type: 'gasto', amount: 30 },
      { type: 'ingreso', amount: 20 },
    ]), { totalIngresos: 120, totalGastos: 30 });
  });
});
