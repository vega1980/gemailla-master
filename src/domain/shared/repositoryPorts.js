/**
 * @typedef {Object} EntityRepositoryPort
 * @property {(data: Record<string, unknown>) => Promise<Record<string, unknown>>} create
 * @property {(items: Array<Record<string, unknown>>) => Promise<Array<Record<string, unknown>>>} bulkCreate
 * @property {(id: string) => Promise<Record<string, unknown>>} archive
 */

/**
 * @typedef {Object} ImportLogRepositoryPort
 * @property {(data: Record<string, unknown>) => Promise<Record<string, unknown>>} create
 */

/**
 * @typedef {Object} FinanceRepositoriesPort
 * @property {EntityRepositoryPort} transactions
 * @property {ImportLogRepositoryPort} importLogs
 */

export const REPOSITORY_PORTS_DOCUMENTATION = Object.freeze({
  purpose: 'Contratos de dominio para aislar casos de uso de proveedores concretos como Firebase.',
  providerBoundary: 'La capa de presentación consume servicios de aplicación; solo infraestructura implementa estos puertos.',
});
