import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  calculateTransactionTotals,
  createTransactionService,
  normalizeTransactionDraft,
  prepareTransactionImportRows,
} from '../../src/domain/finance/transactionService.js';

describe('transaction domain service', () => {
  it('normaliza borradores y exige companyId antes de tocar infraestructura', () => {
    assert.deepEqual(normalizeTransactionDraft({ type: 'gasto', amount: '12.50' }, 'company-1', { fallbackDate: new Date('2026-01-02T00:00:00Z') }), {
      type: 'gasto',
      amount: 12.5,
      companyId: 'company-1',
      description: '',
      date: '2026-01-02',
      category: 'otros_gastos',
      paymentMethod: 'transferencia',
      status: 'confirmed',
    });

    assert.throws(() => normalizeTransactionDraft({ amount: 10 }, ''), /companyId es obligatorio/);
    assert.throws(() => normalizeTransactionDraft({ amount: 0 }, 'company-1'), /mayor a cero/);
  });

  it('mapea filas importadas en español dentro del dominio y tolera metodo_pago vacío', () => {
    const prepared = prepareTransactionImportRows([
      {
        tipo: 'gasto',
        monto: '$3,500',
        descripcion: 'Renta oficina',
        fecha: '01/05/2026',
        categoria: 'renta',
        metodo_pago: undefined,
      },
      {
        tipo: 'ingreso',
        monto: '15000',
        descripcion: '',
        fecha: '2026-05-02',
        categoria: 'ventas',
        metodo_pago: 'tarjeta credito',
      },
    ], 'company-1', { fallbackDate: new Date('2026-01-02T00:00:00Z') });

    assert.deepEqual(prepared.rows.map((row) => ({
      type: row.type,
      amount: row.amount,
      date: row.date,
      category: row.category,
      paymentMethod: row.paymentMethod,
    })), [
      { type: 'gasto', amount: 3500, date: '2026-05-01', category: 'renta', paymentMethod: 'transferencia' },
      { type: 'ingreso', amount: 15000, date: '2026-05-02', category: 'ventas', paymentMethod: 'tarjeta_credito' },
    ]);
    assert.deepEqual(prepared.errors, ['Fila 3: descripción vacía; se importará sin descripción.']);
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
