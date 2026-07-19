import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { revisionQueueApi, type RevisionQueueResult } from '../api/revisionQueue';

const KEY = ['revisionQueue'];

export function useRevisionQueue() {
  const qc = useQueryClient();

  const q = useQuery<RevisionQueueResult>({
    queryKey: KEY,
    queryFn: () => revisionQueueApi.getQueue(),
  });

  const mutation = useMutation({
    mutationFn: (page: number) => revisionQueueApi.markReviewed(page),
    // AC3.3: reviewed pages leave today's queue without a refetch.
    onMutate: async (page) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<RevisionQueueResult>(KEY);
      qc.setQueryData<RevisionQueueResult>(KEY, (cur) =>
        cur
          ? {
              items: cur.items.filter((i) => i.page !== page),
              reviewedThisWeek: cur.reviewedThisWeek + 1,
            }
          : cur
      );
      return { prev };
    },
    onError: (_err, _page, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['mushafPages'] });
    },
  });

  const markReviewed = useCallback((page: number) => mutation.mutateAsync(page), [mutation]);

  return {
    items: q.data?.items ?? [],
    reviewedThisWeek: q.data?.reviewedThisWeek ?? 0,
    isLoading: q.isLoading,
    markReviewed,
  };
}
