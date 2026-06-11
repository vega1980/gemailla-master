
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

import { useQuery } from '@tanstack/react-query';
import { buildCompanyEntityQuery } from '@/lib/companyEntityQueries';

const getCompanyId = (companyOrId) => (
  typeof companyOrId === 'string' ? companyOrId : companyOrId?.id
);

const getQueryData = (query) => query.data || [];

export function useCompanyData(companyOrId, options = {}) {
  const companyId = getCompanyId(companyOrId);
  const enabled = !!companyId && (options.enabled ?? true);

  const sharedOptions = {
    enabled,
    staleTime: options.staleTime,
    gcTime: options.gcTime,
    query: options.query,
  };

  const transactionsQuery = useQuery(buildCompanyEntityQuery('transactions', companyId, sharedOptions));
  const documentsQuery = useQuery(buildCompanyEntityQuery('documents', companyId, sharedOptions));
  const kpisQuery = useQuery(buildCompanyEntityQuery('kpis', companyId, sharedOptions));
  const queries = [transactionsQuery, documentsQuery, kpisQuery];

  return {
    transactions: getQueryData(transactionsQuery),
    documents: getQueryData(documentsQuery),
    kpis: getQueryData(kpisQuery),
    isLoading: queries.some((query) => query.isLoading),
    isFetching: queries.some((query) => query.isFetching),
    isError: queries.some((query) => query.isError),
    error: transactionsQuery.error || documentsQuery.error || kpisQuery.error,
    queries: {
      transactions: transactionsQuery,
      documents: documentsQuery,
      kpis: kpisQuery,
    },
  };
}

export default useCompanyData;

