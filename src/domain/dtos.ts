export type CompanyRole = 'director' | 'admin' | 'miembro' | 'invitado';
export type CompanyStatus = 'active' | 'archived' | 'invited' | 'suspended';
export type DocumentStatus = 'pending' | 'processing' | 'analyzed' | 'error' | 'archived' | 'ai_disabled';
export type DocumentType = 'factura' | 'nota_credito' | 'recibo' | 'contrato' | 'estado_cuenta' | 'declaración' | 'nómina' | 'otro';
export type TransactionType = 'ingreso' | 'gasto';
export type TransactionStatus = 'confirmed' | 'pending' | 'archived';

export interface FirestoreBaseDto {
  id?: string;
  companyId: string;
  ownerUid?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CompanyDto {
  id?: string;
  name: string;
  rfc?: string;
  industry?: string;
  email?: string;
  ownerUid?: string;
  status: CompanyStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CompanyMemberDto extends FirestoreBaseDto {
  userUid?: string;
  userEmail: string;
  userName?: string;
  role: CompanyRole;
  status: CompanyStatus;
}

export interface DocumentDto extends FirestoreBaseDto {
  name: string;
  docType: DocumentType;
  storagePath?: string;
  downloadUrl?: string;
  mimeType?: 'application/pdf' | 'text/xml' | 'application/xml' | string;
  sizeBytes?: number;
  status: DocumentStatus;
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

export interface AiRequestDto {
  companyId: string;
  prompt?: string;
  documentIds?: string[];
  correlationId?: string;
  parentCorrelationId?: string;
  model?: string;
}

export interface AiResponseDto {
  response?: string;
  message?: string;
  summary?: string;
  disabled?: boolean;
  status?: string;
  correlationId: string;
}

export interface StorageObjectDto {
  companyId: string;
  documentId: string;
  storagePath: string;
  contentType: 'application/pdf' | 'text/xml' | 'application/xml' | string;
  sizeBytes: number;
}
