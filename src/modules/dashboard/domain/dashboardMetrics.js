const EXPENSE_TYPES = new Set(['gasto', 'expense', 'egreso']);

function asFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function percentageChange(currentValue, previousValue) {
  const current = asFiniteNumber(currentValue);
  const previous = asFiniteNumber(previousValue);

  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function previousMonthKey(monthKey) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(monthKey || ''));
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;

  const previousMonth = new Date(Date.UTC(year, month - 2, 1));
  return `${previousMonth.getUTCFullYear()}-${String(previousMonth.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function buildMonthlyTrends(monthlyMetrics = []) {
  const metricsByMonth = new Map();

  monthlyMetrics.forEach((metric) => {
    if (!previousMonthKey(metric?.month)) return;
    metricsByMonth.set(metric.month, metric);
  });

  const latestMonthKey = [...metricsByMonth.keys()].sort().at(-1);
  const previousKey = previousMonthKey(latestMonthKey);
  const latest = metricsByMonth.get(latestMonthKey);
  const previous = metricsByMonth.get(previousKey);

  if (!latest || !previous) {
    return { income: null, expenses: null, balance: null };
  }

  return {
    income: percentageChange(latest.totalIncome, previous.totalIncome),
    expenses: percentageChange(latest.totalExpenses, previous.totalExpenses),
    balance: percentageChange(latest.netCashFlow, previous.netCashFlow),
  };
}

export function isExpenseTransaction(transaction = {}) {
  return EXPENSE_TYPES.has(String(transaction.type || '').trim().toLowerCase());
}

export function buildFinancialDistribution(income, expenses) {
  return [
    { name: 'Ingresos', value: Math.max(asFiniteNumber(income), 0) },
    { name: 'Gastos', value: Math.max(asFiniteNumber(expenses), 0) },
  ];
}
