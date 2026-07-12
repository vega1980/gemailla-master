// @ts-check

/** @type {ReadonlySet<import('@/domain/dtos').TransactionType>} */
const VALID_TRANSACTION_TYPES = new Set(['ingreso', 'gasto']);

/** @type {ReadonlySet<import('@/domain/dtos').TransactionStatus>} */
const VALID_TRANSACTION_STATUSES = new Set(['confirmed', 'pending', 'archived']);

/** @type {Readonly<Record<string, string>>} */
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

/** @type {Readonly<Record<string, string>>} */
const PAYMENT_METHOD_MAP = Object.freeze({
  efectivo: 'efectivo',
  transferencia: 'transferencia',
  'tarjeta credito': 'tarjeta_credito',
  'tarjeta crédito': 'tarjeta_credito',
  'tarjeta débito': 'tarjeta_debito',
  'tarjeta debito': 'tarjeta_debito',
  cheque: 'cheque',
});

/** @param {unknown} companyId @returns {asserts companyId is string} */
function assertCompanyId(companyId) {
  if (typeof companyId !== 'string' || !companyId.trim()) {
    throw new Error('companyId es obligatorio para operar transacciones.');
  }
}

/** @param {unknown} value */
function normalizeText(value) {
  return String(value ?? '').trim();
}

/** @param {unknown} value */
function normalizeLookupKey(value) {
  return normalizeText(value).toLowerCase();
}

/** @param {unknown} amount */
function normalizeAmount(amount) {
  const rawAmount = normalizeText(amount);
  const numericAmount = typeof amount === 'number'
    ? amount
    : /^\$?\d{1,3}(?:,\d{3})*(?:\.\d+)?$|^\$?\d+(?:\.\d+)?$/.test(rawAmount)
      ? Number(rawAmount.replace(/[$,]/g, ''))
      : Number.NaN;
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error('El monto de la transacción debe ser mayor a cero.');
  }
  return numericAmount;
}

/** @param {Record<string, unknown>} draft */
function normalizeType(draft = {}) {
  const explicitType = normalizeLookupKey(draft.type);
  const fallbackType = explicitType || normalizeLookupKey(draft.tipo);
  if (!fallbackType) return 'ingreso';
  if (VALID_TRANSACTION_TYPES.has(/** @type {import('@/domain/dtos').TransactionType} */ (fallbackType))) return /** @type {import('@/domain/dtos').TransactionType} */ (fallbackType);
  throw new Error('El tipo de transacción debe ser ingreso o gasto.');
}

/** @param {unknown} rawStatus */
function normalizeStatus(rawStatus) {
  const status = normalizeLookupKey(rawStatus);
  if (!status) return 'confirmed';
  if (VALID_TRANSACTION_STATUSES.has(/** @type {import('@/domain/dtos').TransactionStatus} */ (status))) return /** @type {import('@/domain/dtos').TransactionStatus} */ (status);
  throw new Error('El estado de la transacción no es válido.');
}

/** @param {unknown} rawCategory @param {import('@/domain/dtos').TransactionType} type */
function normalizeCategory(rawCategory, type) {
  const key = normalizeLookupKey(rawCategory);
  return CATEGORY_MAP[key] || (type === 'ingreso' ? 'ventas' : 'otros_gastos');
}

/** @param {unknown} rawPaymentMethod */
function normalizePaymentMethod(rawPaymentMethod) {
  const key = normalizeLookupKey(rawPaymentMethod);
  return PAYMENT_METHOD_MAP[key] || 'transferencia';
}

/** @param {number} year @param {number} month @param {number} day */
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

/** @param {unknown} rawDate */
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

/** @param {Record<string, unknown>} draft */
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

/**
 * @param {Record<string, unknown>} draft
 * @param {string} companyId
 * @returns {import('@/domain/dtos').TransactionDto}
 */
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
    companyId: companyId.trim(),
    type,
    amount: normalizeAmount(draft.amount ?? monto),
    description: normalizeText(draft.description ?? descripcion),
    date: normalizeDate(draft.date ?? fecha),
    category: normalizeCategory(category, type),
    paymentMethod: normalizePaymentMethod(paymentMethod),
    status: normalizeStatus(draft.status),
  };
}

/**
 * @param {Record<string, unknown>[]} rows
 * @param {string} companyId
 * @param {Record<string, unknown>} [options]
 */
export function prepareTransactionImportRows(rows = [], companyId, options = {}) {
  assertCompanyId(companyId);
  /** @type {import('@/domain/dtos').TransactionDto[]} */
  const validRows = [];
  /** @type {string[]} */
  const errors = [];

  rows.forEach((row, index) => {
    try {
      const normalized = normalizeTransactionDraft(row, companyId);
      if (!normalized.description) errors.push(`Fila ${index + 2}: descripción vacía; se importará sin descripción.`);
      validRows.push(normalized);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido.';
      errors.push(`Fila ${index + 2}: ${message}`);
    }
  });

  return { rows: validRows, errors };
}

/** @param {Array<Pick<import('@/domain/dtos').TransactionDto, 'amount' | 'type'>>} transactions */
export function calculateTransactionTotals(transactions = []) {
  return transactions.reduce((totals, transaction) => {
    const amount = Number(transaction.amount || 0);
    if (transaction.type === 'ingreso') return { ...totals, totalIngresos: totals.totalIngresos + amount };
    if (transaction.type === 'gasto') return { ...totals, totalGastos: totals.totalGastos + amount };
    return totals;
  }, { totalIngresos: 0, totalGastos: 0 });
}

/**
 * @param {{ transactions: { create(draft: import('@/domain/dtos').TransactionDto): Promise<unknown>, archive(id: string): Promise<unknown>, bulkCreate(rows: import('@/domain/dtos').TransactionDto[]): Promise<unknown[]> }, importLogs?: { create(payload: Record<string, unknown>): Promise<unknown> } }} repositories
 */
export function createTransactionService(repositories) {
  if (!repositories?.transactions) throw new Error('transactions repository requerido.');

  return Object.freeze({
    /** @param {Record<string, unknown>} draft @param {string} companyId */
    create(draft, companyId) {
      return repositories.transactions.create(normalizeTransactionDraft(draft, companyId));
    },
    /** @param {string} transactionId */
    archive(transactionId) {
      if (!transactionId) throw new Error('transactionId es obligatorio para archivar.');
      return repositories.transactions.archive(transactionId);
    },
    /** @param {Record<string, unknown>[]} rows @param {string} companyId @param {Record<string, unknown>} [options] */
    prepareImport(rows, companyId, options) {
      return prepareTransactionImportRows(rows, companyId, options);
    },
    /** @param {{ rows: Record<string, unknown>[], companyId: string, importLog?: Record<string, unknown> }} params */
    async bulkImport({ rows, companyId, importLog = {} }) {
      assertCompanyId(companyId);
      const normalizedRows = rows.map((row) => normalizeTransactionDraft(row, companyId));
      const created = normalizedRows.length
        ? await repositories.transactions.bulkCreate(normalizedRows)
        : [];

      if (repositories.importLogs?.create && importLog.status) {
        await repositories.importLogs.create({
          ...importLog,
          companyId: companyId.trim(),
          type: 'transactions',
          validCount: created.length,
        });
      }

      return created;
    },
    calculateTotals: calculateTransactionTotals,
  });
}
