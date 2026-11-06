import assert from 'node:assert/strict';
import { test } from 'node:test';
import { confirmedTransactions, transactionsInPeriod, summarizeTransactions, summarizeByMonth } from '../../src/domain/finance/financialReport.js';

const transactions = [
  { type: 'ingreso', amount: 100, date: '2026-01-05', status: 'confirmed', category: 'ventas' },
  { type: 'gasto', amount: 40, date: '2026-01-07', status: 'confirmed', category: 'renta' },
  { type: 'ingreso', amount: 999, date: '2026-01-08', status: 'pending' },
  { type: 'gasto', amount: 999, date: '2026-01-08', status: 'archived' },
  { type: 'ingreso', amount: 10, date: '2026-02-01', status: 'confirmed' },
];

test('excludes pending and archived transactions', () => {
  assert.equal(confirmedTransactions(transactions).length, 3);
  assert.equal(transactionsInPeriod(transactions, '2026-01-01', '2026-01-31').length, 2);
});

test('calculates only the confirmed movement result', () => {
  const summary = summarizeTransactions(transactionsInPeriod(transactions, '2026-01-01', '2026-01-31'));
  assert.equal(summary.totalIngresos, 100);
  assert.equal(summary.totalGastos, 40);
  assert.equal(summary.resultado, 60);
  assert.equal(summary.margen, 60);
});

test('groups months from the selected transactions only', () => {
  assert.deepEqual(summarizeByMonth(transactionsInPeriod(transactions, '2026-01-01', '2026-01-31')), [
    { month: '2026-01', ingresos: 100, gastos: 40, neto: 60 },
  ]);
});

test('does not concatenate string amounts', () => {
  assert.equal(summarizeTransactions([{ type: 'ingreso', amount: '25.50', status: 'confirmed' }]).totalIngresos, 25.5);
});
