const VALID_TRANSACTION_TYPES = new Set(['ingreso', 'gasto']);

const CATEGORY_MAP = Object.freeze({
  ventas: 'ventas',
  servicios: 'servicios',
  inversiones: 'inversiones',
  'otros ingresos': 'otros_ingresos',
  nomina: 'nómina',
  nómina: 'nómina',
  renta: 'renta',
  'servicios profesionales': 'servicios_profesionales',
  materiales: 'materiales',
  marketing: 'marketing',
  impuestos: 'impuestos',
  seguros: 'seguros',
  mantenimiento: 'mantenimiento',
  tecnologia: 'tecnología',
  tecnología: 'tecnología',
  transporte: 'transporte',
  'otros gastos': 'otros_gastos',
});

const PAYMENT_METHOD_MAP = Object.freeze({
  efectivo: 'efectivo',
  transferencia: 'transferencia',
  'tarjeta credito': 'tarjeta_credito',
  'tarjeta crédito': 'tarjeta_credito',
  'tarjeta débito': 'tarjeta_debito',
  'tarjeta debito': 'tarjeta_debito',
  cheque: 'cheque',
});

function assertCompanyId(companyId) {
  if (!companyId || typeof companyId !== 'string') {
    throw new Error('companyId es obligatorio para operar transacciones.');
  }
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeLookupKey(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeAmount(amount) {
  const numericAmount = typeof amount === 'number'
    ? amount
    : Number.parseFloat(String(amount ?? '').replace(/[$,\s]/g, ''));
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error('El monto de la transacción debe ser mayor a cero.');
  }
  return numericAmount;
}

function normalizeType(draft = {}) {
  const explicitType = normalizeLookupKey(draft.type || draft.tipo);
  if (explicitType.includes('gasto')) return 'gasto';
  if (VALID_TRANSACTION_TYPES.has(explicitType)) return explicitType;
  return 'ingreso';
}

function normalizeCategory(rawCategory, type) {
  const key = normalizeLookupKey(rawCategory);
  return CATEGORY_MAP[key] || (type === 'ingreso' ? 'ventas' : 'otros_gastos');
}

function normalizePaymentMethod(rawPaymentMethod) {
  const key = normalizeLookupKey(rawPaymentMethod);
  return PAYMENT_METHOD_MAP[key] || 'transferencia';
}

function normalizeDate(rawDate, fallbackDate = new Date()) {
  const raw = normalizeText(rawDate);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split('/');
    return `${year}-${month}-${day}`;
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
    const [month, day, year] = raw.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return fallbackDate.toISOString().slice(0, 10);
}

export function normalizeTransactionDraft(draft = {}, companyId, options = {}) {
  assertCompanyId(companyId);
  const type = normalizeType(draft);
  const category = draft.category || draft.categoria;
  const paymentMethod = draft.paymentMethod || draft.metodo_pago;

  return {
    ...draft,
    companyId,
    type,
    amount: normalizeAmount(draft.amount ?? draft.monto),
    description: normalizeText(draft.description ?? draft.descripcion),
    date: normalizeDate(draft.date ?? draft.fecha, options.fallbackDate),
    category: normalizeCategory(category, type),
    paymentMethod: normalizePaymentMethod(paymentMethod),
    status: draft.status || 'confirmed',
  };
}

export function prepareTransactionImportRows(rows = [], companyId, options = {}) {
  assertCompanyId(companyId);
  const validRows = [];
  const errors = [];

  rows.forEach((row, index) => {
    try {
      const normalized = normalizeTransactionDraft(row, companyId, options);
      if (!normalized.description) errors.push(`Fila ${index + 2}: descripción vacía; se importará sin descripción.`);
      validRows.push(normalized);
    } catch (error) {
      errors.push(`Fila ${index + 2}: ${error.message}`);
    }
  });

  return { rows: validRows, errors };
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
    prepareImport(rows, companyId, options) {
      return prepareTransactionImportRows(rows, companyId, options);
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
