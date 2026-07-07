import { createTransactionUseCases } from '@/application/finance/transactionUseCases';
import { createFirebaseFinanceRepositories } from '@/infrastructure/firebase/adapters/financeRepositories';

export const financeUseCases = createTransactionUseCases(createFirebaseFinanceRepositories());

export const {
  archiveTransaction,
  calculateTransactionTotals,
  createTransaction,
  createTransactionImportLog,
  importTransactions,
} = financeUseCases;
