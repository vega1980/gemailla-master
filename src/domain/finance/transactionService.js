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

function assertValidDateParts(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    throw new Error('La fecha de la transacción no es válida.');
  }
}

function normalizeDate(rawDate) {
  const raw = normalizeText(rawDate);
  let year;
  let month;
  let day;

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    [, year, month, day] = isoMatch;
  } else {
    const dayFirstMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!dayFirstMatch) throw new Error('La fecha de la transacción no es válida.');
    [, day, month, year] = dayFirstMatch;
  }

  const numericYear = Number(year);
  const numericMonth = Number(month);
  const numericDay = Number(day);
  assertValidDateParts(numericYear, numericMonth, numericDay);

  return `${String(numericYear).padStart(4, '0')}-${String(numericMonth).padStart(2, '0')}-${String(numericDay).padStart(2, '0')}`;
}

function pickAllowedDraftFields(draft = {}) {
  return Object.fromEntries(
    [
      'reference',
      'notes',
      'expense_type',
      'isRecurring',
      'dueDate',
      'supplier_id',
    ]
      .filter((field) => Object.hasOwn(draft, field))
      .map((field) => [field, draft[field]]),
  );
}

export function normalizeTransactionDraft(draft = {}, companyId) {
  assertCompanyId(companyId);
  const {
    monto,
    descripcion,
    fecha,
    categoria,
    metodo_pago: metodoPago,
  } = draft;
  const type = normalizeType(draft);
  const category = draft.category || categoria;
  const paymentMethod = draft.paymentMethod || metodoPago;

  return {
    ...pickAllowedDraftFields(draft),
    companyId,
    type,
    amount: normalizeAmount(draft.amount ?? monto),
    description: normalizeText(draft.description ?? descripcion),
    date: normalizeDate(draft.date ?? fecha),
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
      const normalized = normalizeTransactionDraft(row, companyId);
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
