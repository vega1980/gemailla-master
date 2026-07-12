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
    assert.deepEqual(normalizeTransactionDraft({ type: 'gasto', amount: '12.50', date: '2026-01-02' }, 'company-1'), {
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
    assert.throws(() => normalizeTransactionDraft({ amount: 0, date: '2026-01-02' }, 'company-1'), /mayor a cero/);
  });

  it('mapea filas importadas en español dentro del dominio y tolera metodo_pago vacío', () => {
    const prepared = prepareTransactionImportRows([
      {
        tipo: 'gasto',
        monto: '$3,500',
        descripcion: 'Renta oficina',
        fecha: '1/5/2026',
        categoria: 'renta',
        metodo_pago: undefined,
      },
      {
        tipo: 'ingreso',
        monto: '15000',
        descripcion: '',
        fecha: '02/05/2026',
        categoria: 'ventas',
        metodo_pago: 'tarjeta credito',
      },
    ], 'company-1');

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

  it('no conserva alias españoles del archivo en la transacción normalizada', () => {
    const normalized = normalizeTransactionDraft({
      tipo: 'gasto',
      monto: '100',
      descripcion: 'Pago proveedor',
      fecha: '7/7/2026',
      categoria: 'materiales',
      metodo_pago: 'cheque',
      notes: 'Campo legítimo del formulario',
    }, 'company-1');

    assert.deepEqual(Object.keys(normalized).sort(), [
      'amount',
      'category',
      'companyId',
      'date',
      'description',
      'notes',
      'paymentMethod',
      'status',
      'type',
    ].sort());
    assert.equal(normalized.date, '2026-07-07');
  });

  it('normaliza fechas d/M/yyyy, dd/MM/yyyy e invalida fechas imposibles', () => {
    assert.equal(normalizeTransactionDraft({ amount: 10, date: '1/5/2026' }, 'company-1').date, '2026-05-01');
    assert.equal(normalizeTransactionDraft({ amount: 10, date: '01/05/2026' }, 'company-1').date, '2026-05-01');
    assert.equal(normalizeTransactionDraft({ amount: 10, date: '2026-05-01' }, 'company-1').date, '2026-05-01');
    assert.throws(() => normalizeTransactionDraft({ amount: 10, date: '31/02/2026' }, 'company-1'), /fecha de la transacción no es válida/i);
    assert.throws(() => normalizeTransactionDraft({ amount: 10, date: '02/31/2026' }, 'company-1'), /fecha de la transacción no es válida/i);
  });


  it('usa tipo como respaldo cuando type está ausente o vacío', () => {
    assert.equal(normalizeTransactionDraft({ type: '', tipo: 'gasto', amount: 10, date: '2026-01-02' }, 'company-1').type, 'gasto');
    assert.equal(normalizeTransactionDraft({ type: '   ', tipo: 'gasto', amount: 10, date: '2026-01-02' }, 'company-1').type, 'gasto');
    assert.equal(normalizeTransactionDraft({ tipo: 'gasto', amount: 10, date: '2026-01-02' }, 'company-1').type, 'gasto');
    assert.equal(normalizeTransactionDraft({ type: '', tipo: '', amount: 10, date: '2026-01-02' }, 'company-1').type, 'ingreso');
    assert.throws(
      () => normalizeTransactionDraft({ type: 'bono', tipo: 'gasto', amount: 10, date: '2026-01-02' }, 'company-1'),
      /El tipo de transacción debe ser ingreso o gasto\./,
    );
  });

  it('valida tipos, estados, montos y companyId sin conversiones silenciosas', () => {
    assert.equal(normalizeTransactionDraft({ type: 'ingreso', amount: 10, date: '2026-01-02' }, ' company-1 ').type, 'ingreso');
    assert.equal(normalizeTransactionDraft({ type: 'ingreso', amount: 10, date: '2026-01-02' }, ' company-1 ').companyId, 'company-1');
    assert.equal(normalizeTransactionDraft({ type: 'gasto', amount: 10, date: '2026-01-02' }, 'company-1').type, 'gasto');
    assert.equal(normalizeTransactionDraft({ amount: 10, date: '2026-01-02' }, 'company-1').type, 'ingreso');
    assert.throws(
      () => normalizeTransactionDraft({ type: 'gastos operativos', amount: 10, date: '2026-01-02' }, 'company-1'),
      /El tipo de transacción debe ser ingreso o gasto\./,
    );

    assert.equal(normalizeTransactionDraft({ amount: 10, date: '2026-01-02' }, 'company-1').status, 'confirmed');
    assert.equal(normalizeTransactionDraft({ amount: 10, date: '2026-01-02', status: 'pending' }, 'company-1').status, 'pending');
    assert.equal(normalizeTransactionDraft({ amount: 10, date: '2026-01-02', status: 'archived' }, 'company-1').status, 'archived');
    assert.throws(
      () => normalizeTransactionDraft({ amount: 10, date: '2026-01-02', status: 'deleted' }, 'company-1'),
      /El estado de la transacción no es válido\./,
    );

    assert.throws(() => normalizeTransactionDraft({ amount: '10abc', date: '2026-01-02' }, 'company-1'), /mayor a cero/);
    assert.equal(normalizeTransactionDraft({ amount: '$3,500.50', date: '2026-01-02' }, 'company-1').amount, 3500.5);
    assert.throws(() => normalizeTransactionDraft({ amount: 10, date: '2026-01-02' }, '   '), /companyId es obligatorio/);
  });

  it('convierte errores de importación en errores de fila', () => {
    const prepared = prepareTransactionImportRows([
      { type: 'ingreso', amount: '$3,500.50', date: '2026-01-02' },
      { type: 'bono', amount: 10, date: '2026-01-02' },
      { type: 'gasto', amount: '10abc', date: '2026-01-02' },
      { type: 'ingreso', amount: 10, date: '2026-01-02', status: 'deleted' },
    ], 'company-1');

    assert.equal(prepared.rows.length, 1);
    assert.equal(prepared.rows[0].amount, 3500.5);
    assert.deepEqual(prepared.errors, [
      'Fila 2: descripción vacía; se importará sin descripción.',
      'Fila 3: El tipo de transacción debe ser ingreso o gasto.',
      'Fila 4: El monto de la transacción debe ser mayor a cero.',
      'Fila 5: El estado de la transacción no es válido.',
    ]);
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
      rows: [{ type: 'ingreso', amount: '100', date: '2026-01-02' }, { type: 'gasto', amount: 40, date: '2026-01-03' }],
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
