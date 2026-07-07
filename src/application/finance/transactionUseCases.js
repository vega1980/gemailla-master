import { createTransactionService } from '@/domain/finance/transactionService';

export function createTransactionUseCases(repositories) {
  const transactionService = createTransactionService(repositories);

  return Object.freeze({
    createTransaction: (draft, companyId) => transactionService.create(draft, companyId),
    archiveTransaction: (transactionId) => transactionService.archive(transactionId),
    importTransactions: (params) => transactionService.bulkImport(params),
    createTransactionImportLog: (payload) => repositories.importLogs.create({
      ...payload,
      type: 'transactions',
      errors: (payload.errors || []).slice(0, 100),
      importedAt: payload.importedAt || new Date().toISOString(),
    }),
    calculateTransactionTotals: (transactions) => transactionService.calculateTotals(transactions),
  });
}
