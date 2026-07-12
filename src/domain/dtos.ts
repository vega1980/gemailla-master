export type TransactionType = 'ingreso' | 'gasto';
export type TransactionStatus = 'confirmed' | 'pending' | 'archived';

export interface FirestoreBaseDto {
  id?: string;
  companyId: string;
  ownerUid?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TransactionDto extends FirestoreBaseDto {
  type: TransactionType;
  amount: number;
  description: string;
  date: string;
  category: string;
  paymentMethod: string;
  status: TransactionStatus;
  reference?: string;
  notes?: string;
  expense_type?: string;
  isRecurring?: boolean;
  dueDate?: string;
  supplier_id?: string;
}
