import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { revisionsApi, Revision } from '../api';

const KEY = ['revisions'];

export function useRevisions() {
  const qc = useQueryClient();
  const q = useQuery<Revision[]>({ queryKey: KEY, queryFn: () => revisionsApi.getMyRevisions() });

  const fetchRevisions = useCallback(async () => {
    await q.refetch();
  }, [q.refetch]);

  const createRevision = useCallback(
    async (studentId: string, surahId: number, scheduledFor: string) => {
      const created = await revisionsApi.createRevision(studentId, surahId, scheduledFor);
      qc.setQueryData<Revision[]>(KEY, (prev) => [created, ...(prev ?? [])]);
      return created;
    },
    [qc]
  );

  const markRevision = useCallback(
    async (id: string, status: 'COMPLETED' | 'MISSED') => {
      const updated = await revisionsApi.markRevision(id, status);
      qc.setQueryData<Revision[]>(KEY, (prev) => (prev ?? []).map((r) => (r.id === id ? updated : r)));
      return updated;
    },
    [qc]
  );

  const removeRevision = useCallback(
    async (id: string) => {
      await revisionsApi.deleteRevision(id);
      qc.setQueryData<Revision[]>(KEY, (prev) => (prev ?? []).filter((r) => r.id !== id));
    },
    [qc]
  );

  return {
    revisions: q.data ?? [],
    isLoading: q.isLoading,
    error: q.error ? (q.error as Error).message : null,
    fetchRevisions,
    createRevision,
    markRevision,
    removeRevision,
  };
}
