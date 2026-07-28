import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { auditLogsApi, type AuditLogFilters, type AuditLogPage } from '../api/auditLogs';

const PAGE_SIZE = 20;

export function useAuditLogs() {
  const qc = useQueryClient();
  const [filters, setFiltersState] = useState<AuditLogFilters>({});
  const [page, setPage] = useState(1);

  const q = useQuery<AuditLogPage>({
    queryKey: ['auditLogs', filters, page],
    queryFn: () => auditLogsApi.list({ ...filters, page, limit: PAGE_SIZE }),
  });

  // Changing a filter must reset to page 1 — otherwise a narrower filter can
  // land the user on a page that no longer exists and render an empty list.
  const setFilters = useCallback((next: AuditLogFilters) => {
    setFiltersState(next);
    setPage(1);
  }, []);

  const refresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ['auditLogs'] });
  }, [qc]);

  const meta = q.data?.meta ?? { page, limit: PAGE_SIZE, total: 0 };
  return {
    rows: q.data?.data ?? [],
    meta,
    totalPages: Math.max(1, Math.ceil(meta.total / PAGE_SIZE)),
    isLoading: q.isLoading,
    error: q.error ? (q.error as Error).message : null,
    filters,
    setFilters,
    page,
    setPage,
    refresh,
  };
}
