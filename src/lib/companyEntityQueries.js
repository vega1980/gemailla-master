import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { firebase } from '@/api/firebaseClient';

const COMPANY_ENTITY_QUERIES = Object.freeze({
  transactions: { entity: 'Transaction', orderBy: '-date' },
  documents: { entity: 'Document', orderBy: '-createdAt' },
  kpis: { entity: 'KPI' },
  projects: { entity: 'Project' },
  projectTasks: { entity: 'ProjectTask' },
  subscriptions: { entity: 'Subscription' },
  supportTickets: { entity: 'SupportTicket', orderBy: '-createdAt' },
  crmClients: { entity: 'CRMClient', orderBy: '-createdAt' },
  crmDeals: { entity: 'CRMDeal', orderBy: '-createdAt' },
  crmInteractions: { entity: 'CRMInteraction', orderBy: '-createdAt' },
  employees: { entity: 'Employee' },
  performanceReviews: { entity: 'PerformanceReview', orderBy: '-createdAt' },
  payrolls: { entity: 'Payroll', orderBy: '-createdAt' },
  auditLogs: { entity: 'AuditLog', orderBy: '-createdAt', limit: 200 },
  aiConversations: { entity: 'AIConversation', orderBy: '-createdAt', limit: 20 },
});

const getCompanyId = (companyOrId) => (
  typeof companyOrId === 'string' ? companyOrId : companyOrId?.id
);

export const companyEntityQueryKey = (queryName, companyOrId, options = {}) => {
  const companyId = getCompanyId(companyOrId);
  const config = COMPANY_ENTITY_QUERIES[queryName] || {};
  const orderBy = options.orderBy ?? config.orderBy ?? null;
  const resultLimit = options.limit ?? config.limit ?? null;
  return ['company-entity', queryName, companyId, { orderBy, limit: resultLimit }];
};


export const paginatedCompanyEntityQueryKey = (queryName, companyOrId, options = {}) => {
  const companyId = getCompanyId(companyOrId);
  const config = COMPANY_ENTITY_QUERIES[queryName] || {};
  const orderBy = options.orderBy ?? config.orderBy ?? null;
  const pageSize = options.pageSize ?? options.limit ?? config.limit ?? 25;
  const filters = options.filters ?? {};
  return ['company-entity-page', queryName, companyId, { orderBy, pageSize, filters }];
};

export const buildPaginatedCompanyEntityQuery = (queryName, companyOrId, options = {}) => {
  const config = COMPANY_ENTITY_QUERIES[queryName];
  if (!config) throw new Error(`Query paginada de entidad desconocida: ${queryName}`);

  const companyId = getCompanyId(companyOrId);
  const orderBy = options.orderBy ?? config.orderBy;
  const pageSize = options.pageSize ?? options.limit ?? config.limit ?? 25;
  const filters = { companyId, ...(options.filters || {}) };

  return {
    queryKey: paginatedCompanyEntityQueryKey(queryName, companyId, { orderBy, pageSize, filters: options.filters || {} }),
    queryFn: ({ pageParam = null }) => firebase.entities[config.entity].paginate({ filters, orderBy, limit: pageSize, cursor: pageParam }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => (lastPage?.hasMore ? lastPage.cursor : undefined),
    enabled: options.enabled ?? Boolean(companyId),
  };
};

export const usePaginatedCompanyEntityQuery = (queryName, companyOrId, options = {}) => {
  const queryOptions = buildPaginatedCompanyEntityQuery(queryName, companyOrId, options);
  return useInfiniteQuery({
    ...queryOptions,
    ...options.query,
    enabled: options.query?.enabled ?? queryOptions.enabled,
  });
};

export const getPaginatedItems = (data) => data?.pages?.flatMap((page) => page.items || []) || [];

export const buildCompanyEntityQuery = (queryName, companyOrId, options = {}) => {
  const config = COMPANY_ENTITY_QUERIES[queryName];
  if (!config) throw new Error(`Query de entidad desconocida: ${queryName}`);

  const companyId = getCompanyId(companyOrId);
  const orderBy = options.orderBy ?? config.orderBy;
  const resultLimit = options.limit ?? config.limit;

  return {
    queryKey: companyEntityQueryKey(queryName, companyId, { orderBy, limit: resultLimit }),
    queryFn: () => firebase.entities[config.entity].filter({ companyId }, orderBy, resultLimit),
    enabled: options.enabled ?? Boolean(companyId),
  };
};

export const useCompanyEntityQuery = (queryName, companyOrId, options = {}) => {
  const queryOptions = buildCompanyEntityQuery(queryName, companyOrId, options);
  return useQuery({
    ...queryOptions,
    ...options.query,
    enabled: options.query?.enabled ?? queryOptions.enabled,
  });
};

export const useCompanyTransactions = (companyOrId, options) => useCompanyEntityQuery('transactions', companyOrId, options);
export const useCompanyDocuments = (companyOrId, options) => useCompanyEntityQuery('documents', companyOrId, options);
export const useCompanyKpis = (companyOrId, options) => useCompanyEntityQuery('kpis', companyOrId, options);
export const useCompanyProjects = (companyOrId, options) => useCompanyEntityQuery('projects', companyOrId, options);
export const useCompanyProjectTasks = (companyOrId, options) => useCompanyEntityQuery('projectTasks', companyOrId, options);
export const useCompanySubscriptions = (companyOrId, options) => useCompanyEntityQuery('subscriptions', companyOrId, options);
export const useCompanySupportTickets = (companyOrId, options) => useCompanyEntityQuery('supportTickets', companyOrId, options);
export const useCompanyCrmClients = (companyOrId, options) => useCompanyEntityQuery('crmClients', companyOrId, options);
export const useCompanyCrmDeals = (companyOrId, options) => useCompanyEntityQuery('crmDeals', companyOrId, options);
export const useCompanyCrmInteractions = (companyOrId, options) => useCompanyEntityQuery('crmInteractions', companyOrId, options);
export const useCompanyEmployees = (companyOrId, options) => useCompanyEntityQuery('employees', companyOrId, options);
export const useCompanyPerformanceReviews = (companyOrId, options) => useCompanyEntityQuery('performanceReviews', companyOrId, options);
export const useCompanyPayrolls = (companyOrId, options) => useCompanyEntityQuery('payrolls', companyOrId, options);
export const useCompanyAuditLogs = (companyOrId, options) => useCompanyEntityQuery('auditLogs', companyOrId, options);
export const useCompanyAiConversations = (companyOrId, options) => useCompanyEntityQuery('aiConversations', companyOrId, options);

export const usePaginatedCompanyTransactions = (companyOrId, options) => usePaginatedCompanyEntityQuery('transactions', companyOrId, options);
export const usePaginatedCompanyDocuments = (companyOrId, options) => usePaginatedCompanyEntityQuery('documents', companyOrId, options);
export const usePaginatedCompanyAuditLogs = (companyOrId, options) => usePaginatedCompanyEntityQuery('auditLogs', companyOrId, options);
export const usePaginatedCompanyCrmClients = (companyOrId, options) => usePaginatedCompanyEntityQuery('crmClients', companyOrId, options);
export const usePaginatedCompanyCrmDeals = (companyOrId, options) => usePaginatedCompanyEntityQuery('crmDeals', companyOrId, options);
