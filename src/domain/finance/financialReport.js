// Resumen operativo de movimientos. No sustituye estados contables auditados.
export function confirmedTransactions(transactions = []) {
  return transactions.filter((transaction) =>
    transaction && (transaction.status == null || transaction.status === 'confirmed')
    && (transaction.type === 'ingreso' || transaction.type === 'gasto')
    && Number.isFinite(Number(transaction.amount))
    && Number(transaction.amount) > 0
  );
}

export function transactionsInPeriod(transactions, start, end) {
  return confirmedTransactions(transactions).filter((transaction) =>
    typeof transaction.date === 'string'
    && transaction.date.slice(0, 10) >= start
    && transaction.date.slice(0, 10) <= end
  );
}

export function summarizeTransactions(transactions) {
  const summary = { totalIngresos: 0, totalGastos: 0, byCategory: {}, incByCategory: {} };
  for (const transaction of confirmedTransactions(transactions)) {
    const amount = Number(transaction.amount);
    const category = transaction.category || 'sin_categoria';
    if (transaction.type === 'ingreso') {
      summary.totalIngresos += amount;
      summary.incByCategory[category] = (summary.incByCategory[category] || 0) + amount;
    } else {
      summary.totalGastos += amount;
      summary.byCategory[category] = (summary.byCategory[category] || 0) + amount;
    }
  }
  const resultado = summary.totalIngresos - summary.totalGastos;
  return {
    ...summary,
    resultado,
    margen: summary.totalIngresos > 0 ? (resultado / summary.totalIngresos) * 100 : 0,
  };
}

export function summarizeByMonth(transactions) {
  const buckets = new Map();
  for (const transaction of confirmedTransactions(transactions)) {
    const month = typeof transaction.date === 'string' ? transaction.date.slice(0, 7) : '';
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) continue;
    const bucket = buckets.get(month) || { month, ingresos: 0, gastos: 0, neto: 0 };
    bucket[transaction.type === 'ingreso' ? 'ingresos' : 'gastos'] += Number(transaction.amount);
    bucket.neto = bucket.ingresos - bucket.gastos;
    buckets.set(month, bucket);
  }
  return [...buckets.values()].sort((a, b) => a.month.localeCompare(b.month));
}
