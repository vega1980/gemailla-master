import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildFinancialDistribution,
  buildMonthlyTrends,
  isExpenseTransaction,
} from '../../src/modules/dashboard/domain/dashboardMetrics.js';

test('calcula tendencias únicamente contra el mes calendario anterior', () => {
  const trends = buildMonthlyTrends([
    { month: '2026-06', totalIncome: 1000, totalExpenses: 500, netCashFlow: 500 },
    { month: '2026-07', totalIncome: 1200, totalExpenses: 400, netCashFlow: 800 },
  ]);

  assert.deepEqual(trends, { income: 20, expenses: -20, balance: 60 });
});

test('no inventa tendencias cuando falta el mes anterior', () => {
  const trends = buildMonthlyTrends([
    { month: '2026-05', totalIncome: 1000, totalExpenses: 500, netCashFlow: 500 },
    { month: '2026-07', totalIncome: 1200, totalExpenses: 400, netCashFlow: 800 },
  ]);

  assert.deepEqual(trends, { income: null, expenses: null, balance: null });
});

test('evita porcentajes infinitos cuando el valor anterior es cero', () => {
  const trends = buildMonthlyTrends([
    { month: '2025-12', totalIncome: 0, totalExpenses: 0, netCashFlow: 0 },
    { month: '2026-01', totalIncome: 100, totalExpenses: 0, netCashFlow: 100 },
  ]);

  assert.deepEqual(trends, { income: null, expenses: 0, balance: null });
});

test('reconoce los tipos reales de gasto y conserva compatibilidad', () => {
  assert.equal(isExpenseTransaction({ type: 'gasto' }), true);
  assert.equal(isExpenseTransaction({ type: 'expense' }), true);
  assert.equal(isExpenseTransaction({ type: 'ingreso' }), false);
});

test('la distribución no cuenta el balance como una tercera categoría', () => {
  assert.deepEqual(buildFinancialDistribution(1000, 400), [
    { name: 'Ingresos', value: 1000 },
    { name: 'Gastos', value: 400 },
  ]);
});
