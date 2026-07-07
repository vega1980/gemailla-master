import { firebase } from '@/api/firebaseClient';

export function createFirebaseFinanceRepositories(client = firebase) {
  return Object.freeze({
    transactions: client.entities.Transaction,
    importLogs: client.entities.ImportLog,
  });
}
