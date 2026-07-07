const VALID_TRANSACTION_TYPES = new Set(['ingreso', 'gasto']);

function assertCompanyId(companyId) {
  if (!companyId || typeof companyId !== 'string') {
    throw new Error('companyId es obligatorio para operar transacciones.');
  }
}

function normalizeAmount(amount) {
  const numericAmount = typeof amount === 'number' ? amount : Number.parseFloat(String(amount || ''));
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error('El monto de la transacción debe ser mayor a cero.');
  }
  return numericAmount;
}

export function normalizeTransactionDraft(draft = {}, companyId) {
  assertCompanyId(companyId);
  const type = VALID_TRANSACTION_TYPES.has(draft.type) ? draft.type : 'ingreso';

  return {
    ...draft,
    companyId,
    type,
    amount: normalizeAmount(draft.amount),
    status: draft.status || 'confirmed',
  };
}

export function calculateTransactionTotals(transactions = []) {
  return transactions.reduce((totals, transaction) => {
    const amount = Number(transaction.amount || 0);
    if (transaction.type === 'ingreso') return { ...totals, totalIngresos: totals.totalIngresos + amount };
    if (transaction.type === 'gasto') return { ...totals, totalGastos: totals.totalGastos + amount };
    return totals;
  }, { totalIngresos: 0, totalGastos: 0 });
}

export function createTransactionService(repositories) {
  if (!repositories?.transactions) throw new Error('transactions repository requerido.');

  return Object.freeze({
    create(draft, companyId) {
      return repositories.transactions.create(normalizeTransactionDraft(draft, companyId));
    },
    archive(transactionId) {
      if (!transactionId) throw new Error('transactionId es obligatorio para archivar.');
      return repositories.transactions.archive(transactionId);
    },
    async bulkImport({ rows, companyId, importLog = {} }) {
      assertCompanyId(companyId);
      const normalizedRows = rows.map((row) => normalizeTransactionDraft(row, companyId));
      const created = normalizedRows.length
        ? await repositories.transactions.bulkCreate(normalizedRows)
        : [];

      if (repositories.importLogs?.create && importLog.status) {
        await repositories.importLogs.create({
          ...importLog,
          companyId,
          type: 'transactions',
          validCount: created.length,
        });
      }

      return created;
    },
    calculateTotals: calculateTransactionTotals,
  });
}
