// @ts-check

export const DOCUMENT_TYPES = Object.freeze({
  INVOICE: 'factura',
  CREDIT_NOTE: 'nota_credito',
  RECEIPT: 'recibo',
  CONTRACT: 'contrato',
  BANK_STATEMENT: 'estado_cuenta',
  TAX_RETURN: 'declaración',
  PAYROLL: 'nómina',
  OTHER: 'otro',
});

/** @type {readonly [import('@/domain/dtos').DocumentType, import('@/domain/dtos').DocumentType, import('@/domain/dtos').DocumentType, import('@/domain/dtos').DocumentType, import('@/domain/dtos').DocumentType, import('@/domain/dtos').DocumentType, import('@/domain/dtos').DocumentType, import('@/domain/dtos').DocumentType]} */
export const DOCUMENT_TYPE_OPTIONS = [
  DOCUMENT_TYPES.INVOICE,
  DOCUMENT_TYPES.CREDIT_NOTE,
  DOCUMENT_TYPES.RECEIPT,
  DOCUMENT_TYPES.CONTRACT,
  DOCUMENT_TYPES.BANK_STATEMENT,
  DOCUMENT_TYPES.TAX_RETURN,
  DOCUMENT_TYPES.PAYROLL,
  DOCUMENT_TYPES.OTHER,
];
