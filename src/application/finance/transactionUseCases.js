import { createTransactionService } from '@/domain/finance/transactionService';

function normalizeImportLogPayload(payload = {}) {
  return {
    ...payload,
    type: 'transactions',
    validCount: payload.validCount || 0,
    errorCount: payload.errorCount || 0,
    errors: (payload.errors || []).slice(0, 100),
    importedAt: payload.importedAt || new Date().toISOString(),
  };
}

export function createTransactionUseCases(repositories) {
  const transactionService = createTransactionService(repositories);

  return Object.freeze({
    createTransaction: (draft, companyId) => transactionService.create(draft, companyId),
    archiveTransaction: (transactionId) => transactionService.archive(transactionId),
    prepareTransactionImport: ({ rows, companyId }) => transactionService.prepareImport(rows, companyId),
    importTransactions: (params) => transactionService.bulkImport(params),
    recordTransactionImportFailure: (payload) => repositories.importLogs.create(normalizeImportLogPayload({
      ...payload,
      status: 'failed',
    })),
    createTransactionImportLog: (payload) => repositories.importLogs.create(normalizeImportLogPayload(payload)),
    calculateTransactionTotals: (transactions) => transactionService.calculateTotals(transactions),
  });
}
