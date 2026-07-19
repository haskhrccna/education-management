import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mushafPagesApi, type PageMemorizationRow, type PageStatus } from '../api/mushafPages';

const KEY = ['mushafPages'];

/** The one place the headline hifz number is computed (single source of truth). */
export function derivePageProgress(rows: PageMemorizationRow[]) {
  const memorized = rows.filter((r) => r.status === 'MEMORIZED' || r.status === 'SOLID').length;
  return { memorized, total: 604, pct: Math.round((memorized / 604) * 100) };
}

export function useMushafPages() {
  const qc = useQueryClient();

  const q = useQuery<PageMemorizationRow[]>({
    queryKey: KEY,
    queryFn: () => mushafPagesApi.getMyPages(),
  });

  const statuses = useMemo(() => {
    const map = new Map<number, PageStatus>();
    (q.data ?? []).forEach((r) => map.set(r.page, r.status));
    return map;
  }, [q.data]);

  const mutation = useMutation({
    mutationFn: ({ page, status }: { page: number; status: PageStatus }) => mushafPagesApi.setPageStatus(page, status),
    onMutate: async ({ page, status }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<PageMemorizationRow[]>(KEY);
      qc.setQueryData<PageMemorizationRow[]>(KEY, (rows) => {
        const next = [...(rows ?? [])];
        const i = next.findIndex((r) => r.page === page);
        const updated: PageMemorizationRow = {
          page,
          status,
          lastReviewedAt:
            status === 'MEMORIZED' || status === 'SOLID' ? new Date().toISOString() : (next[i]?.lastReviewedAt ?? null),
        };
        if (i >= 0) next[i] = updated;
        else next.push(updated);
        return next.sort((a, b) => a.page - b.page);
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
  });

  const setStatus = useCallback(
    (page: number, status: PageStatus) => mutation.mutateAsync({ page, status }),
    [mutation]
  );

  return {
    rows: q.data ?? [],
    statuses,
    progress: derivePageProgress(q.data ?? []),
    setStatus,
    isLoading: q.isLoading,
  };
}
