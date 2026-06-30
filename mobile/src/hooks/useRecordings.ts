import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { recordingsApi, Recording } from '../api';

const KEY = ['recordings'];

export function useRecordings() {
  const qc = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const q = useQuery<Recording[]>({ queryKey: KEY, queryFn: () => recordingsApi.getRecordings() });

  const refresh = useCallback(async () => {
    await q.refetch();
  }, [q.refetch]);

  const upload = useCallback(
    async (formData: FormData): Promise<Recording | null> => {
      setActionError(null);
      try {
        const created = await recordingsApi.uploadRecording(formData);
        qc.setQueryData<Recording[]>(KEY, (prev) => [created, ...(prev ?? [])]);
        return created;
      } catch (err: any) {
        setActionError(err?.response?.data?.message ?? err?.message ?? 'Upload failed');
        return null;
      }
    },
    [qc]
  );

  const review = useCallback(
    async (id: string, approved: boolean, notes?: string): Promise<Recording | null> => {
      setActionError(null);
      try {
        const updated = await recordingsApi.reviewRecording(id, { approved, notes });
        qc.setQueryData<Recording[]>(KEY, (prev) => (prev ?? []).map((r) => (r.id === id ? { ...r, ...updated } : r)));
        return updated;
      } catch (err: any) {
        setActionError(err?.response?.data?.message ?? err?.message ?? 'Review failed');
        return null;
      }
    },
    [qc]
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      setActionError(null);
      try {
        await recordingsApi.deleteRecording(id);
        qc.setQueryData<Recording[]>(KEY, (prev) => (prev ?? []).filter((r) => r.id !== id));
        return true;
      } catch (err: any) {
        setActionError(err?.response?.data?.message ?? err?.message ?? 'Delete failed');
        return false;
      }
    },
    [qc]
  );

  return {
    recordings: q.data ?? [],
    loading: q.isLoading,
    error: q.error ? (q.error as Error).message : actionError,
    refresh,
    upload,
    review,
    remove,
  };
}
