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
  const sharedOptions = {
    enabled: options.enabled,
    staleTime: options.staleTime,
    gcTime: options.gcTime,
  };
  const {
    enabled: queryEnabled,
    queryKey: _queryKey,
    queryFn: _queryFn,
    ...reactQueryOptions
  } = options.query ?? {};

  const results = useQueries({
    queries: queryNames.map((queryName) => {
      const queryOptions = buildCompanyEntityQuery(
        queryName,
        companyOrId,
        {
          ...sharedOptions,
          ...(queryOptionsByName[queryName] ?? {}),
        },
      );

      return {
        ...queryOptions,
        ...reactQueryOptions,
        enabled: queryOptions.enabled && (queryEnabled ?? true),
      };
    }),
  });

  return queryNames.reduce((acc, queryName, index) => {
    const result = results[index];
    acc[queryName] = result?.data ?? [];
    acc[`${queryName}Query`] = result;
    acc.isLoading = acc.isLoading || result?.isLoading || false;
    acc.isFetching = acc.isFetching || result?.isFetching || false;
    acc.isError = acc.isError || result?.isError || false;
    acc.error = acc.error || result?.error || null;
    return acc;
  }, { isLoading: false, isFetching: false, isError: false, error: null });
};

export default useCompanyData;
