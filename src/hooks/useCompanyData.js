import { useQueries } from '@tanstack/react-query';
import { buildCompanyEntityQuery } from '@/lib/companyEntityQueries';

export const COMPANY_DATA_QUERY_NAMES = Object.freeze([
  'transactions',
  'documents',
  'kpis',
  'projects',
  'projectTasks',
  'subscriptions',
  'supportTickets',
  'crmClients',
  'crmDeals',
  'crmInteractions',
  'employees',
  'performanceReviews',
  'payrolls',
  'auditLogs',
  'aiConversations',
]);

export const useCompanyData = (companyOrId, options = {}) => {
  const queryNames = options.queryNames ?? COMPANY_DATA_QUERY_NAMES;
  const queryOptionsByName = options.queries ?? {};

  const results = useQueries({
    queries: queryNames.map((queryName) => buildCompanyEntityQuery(
      queryName,
      companyOrId,
      queryOptionsByName[queryName] ?? {},
    )),
  });

  return queryNames.reduce((acc, queryName, index) => {
    const result = results[index];
    acc[queryName] = result?.data ?? [];
    acc[`${queryName}Query`] = result;
    acc.isLoading = acc.isLoading || result?.isLoading || false;
    acc.isFetching = acc.isFetching || result?.isFetching || false;
    acc.isError = acc.isError || result?.isError || false;
    return acc;
  }, { isLoading: false, isFetching: false, isError: false });
};
