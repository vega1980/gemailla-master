const MAX_BACKGROUND_FILE_BYTES = 15 * 1024 * 1024;
const BACKGROUND_AGENT_NAME = 'contabilidad-proactiva';
const ACCOUNTING_DOCUMENT_TYPES = new Set(['factura', 'invoice', 'xml', 'pdf']);
const EXPENSE_TYPES = new Set(['gasto', 'expense', 'egreso', 'debit', 'cargo']);

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase();
}

function normalizeAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.abs(amount) : 0;
}

function getSupplierName(record = {}) {
  return record.supplierName || record.providerName || record.vendorName || record.counterparty || record.description || 'proveedor';
}

function getSupplierEmail(record = {}) {
  return record.supplierEmail || record.providerEmail || record.vendorEmail || record.email || '';
}

function getDocumentAmount(document = {}) {
  return normalizeAmount(document.total || document.amount || document.invoiceTotal || document.subtotal);
}

function getTransactionAmount(transaction = {}) {
  return normalizeAmount(transaction.amount || transaction.total || transaction.value);
}

function isAccountingCandidate(document = {}, maxFileSizeBytes = MAX_BACKGROUND_FILE_BYTES) {
  const size = Number(document.size || document.fileSize || document.bytes || 0);
  if (Number.isFinite(size) && size > maxFileSizeBytes) return false;

  const extension = normalizeText(document.extension || document.fileExtension || document.title || document.fileName).split('.').pop();
  const mimeType = normalizeText(document.mimeType || document.contentType || document.type);
  const docType = normalizeText(document.docType || document.documentType || document.category);

  return ACCOUNTING_DOCUMENT_TYPES.has(docType)
    || ACCOUNTING_DOCUMENT_TYPES.has(extension)
    || mimeType.includes('pdf')
    || mimeType.includes('xml');
}

function sameSupplier(left = {}, right = {}) {
  const supplier = normalizeText(getSupplierName(left));
  const candidate = normalizeText(getSupplierName(right));
  if (!supplier || !candidate || supplier === 'proveedor' || candidate === 'proveedor') return false;
  return supplier.includes(candidate) || candidate.includes(supplier);
}

function sameAmount(leftAmount, rightAmount) {
  if (!leftAmount || !rightAmount) return false;
  return Math.abs(leftAmount - rightAmount) < 0.01;
}

function isExpenseTransaction(transaction = {}) {
  return EXPENSE_TYPES.has(normalizeText(transaction.type || transaction.kind || transaction.movementType));
}

export function detectMissingSupplierInvoices({ documents = [], transactions = [], maxFileSizeBytes = MAX_BACKGROUND_FILE_BYTES } = {}) {
  const candidates = documents.filter((document) => isAccountingCandidate(document, maxFileSizeBytes));

  return transactions
    .filter(isExpenseTransaction)
    .filter((transaction) => {
      const transactionAmount = getTransactionAmount(transaction);
      return !candidates.some((document) => {
        const documentAmount = getDocumentAmount(document);
        return sameSupplier(transaction, document) && (!transactionAmount || !documentAmount || sameAmount(transactionAmount, documentAmount));
      });
    })
    .map((transaction) => ({
      transactionId: transaction.id || transaction.transactionId || null,
      supplierName: getSupplierName(transaction),
      supplierEmail: getSupplierEmail(transaction),
      amount: getTransactionAmount(transaction),
      date: transaction.date || transaction.createdAt || null,
      description: transaction.description || transaction.concept || '',
    }));
}

export function draftSupplierInvoiceEmail(missingInvoice = {}, company = {}) {
  const supplierName = missingInvoice.supplierName || 'proveedor';
  const amountText = missingInvoice.amount ? ` por ${missingInvoice.amount.toLocaleString('es-MX', { style: 'currency', currency: company.currency || 'MXN' })}` : '';
  const dateText = missingInvoice.date ? ` del ${missingInvoice.date}` : '';

  return {
    to: missingInvoice.supplierEmail || '',
    subject: `Solicitud de factura pendiente - ${company.name || 'GEMAILLA'}`,
    body: `Hola ${supplierName},\n\nDetectamos un movimiento bancario${amountText}${dateText} sin factura XML/PDF conciliada. ¿Nos puedes compartir el comprobante fiscal correspondiente?\n\nGracias.`,
  };
}

export function buildProactiveAccountingActions({ company = {}, documents = [], transactions = [], maxFileSizeBytes = MAX_BACKGROUND_FILE_BYTES } = {}) {
  const missingInvoices = detectMissingSupplierInvoices({ documents, transactions, maxFileSizeBytes });

  return missingInvoices.map((missingInvoice) => ({
    type: 'request_missing_supplier_invoice',
    status: 'pending_approval',
    agentName: BACKGROUND_AGENT_NAME,
    title: `Solicitar factura faltante a ${missingInvoice.supplierName}`,
    rationale: 'El agente encontró un egreso bancario sin XML/PDF conciliado menor a 15MB en documentos.',
    transactionId: missingInvoice.transactionId,
    supplierName: missingInvoice.supplierName,
    emailDraft: draftSupplierInvoiceEmail(missingInvoice, company),
    createdAt: new Date().toISOString(),
  }));
}

async function listEntity(entity, companyId, limit = 100) {
  const page = await entity.listByCompany(companyId, { limit });
  return Array.isArray(page) ? page : page.items || [];
}

export async function runProactiveAccountingAgent({ companyId, company = {}, maxFileSizeBytes = MAX_BACKGROUND_FILE_BYTES } = {}) {
  const safeCompanyId = String(companyId || '').trim();
  if (!safeCompanyId) throw new Error('companyId es obligatorio para ejecutar agentes de contabilidad proactiva.');

  const { firebase } = await import('@/api/firebaseClient');
  const [documents, transactions] = await Promise.all([
    listEntity(firebase.entities.Document, safeCompanyId),
    listEntity(firebase.entities.Transaction, safeCompanyId),
  ]);

  const actions = buildProactiveAccountingActions({ company, documents, transactions, maxFileSizeBytes });
  const conversation = await firebase.agents.createConversation({
    companyId: safeCompanyId,
    agent_name: BACKGROUND_AGENT_NAME,
    metadata: {
      mode: 'background_worker',
      reviewedDocuments: documents.length,
      reviewedTransactions: transactions.length,
      pendingApprovalActions: actions.length,
    },
  });

  return { conversation, actions };
}

export const agentClient = {
  MAX_BACKGROUND_FILE_BYTES,
  BACKGROUND_AGENT_NAME,
  buildProactiveAccountingActions,
  detectMissingSupplierInvoices,
  draftSupplierInvoiceEmail,
  runProactiveAccountingAgent,
};

export default agentClient;
