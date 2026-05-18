import { useCallback, useState } from 'react';
import { revisionsApi, Revision } from '../api';

export function useRevisions() {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRevisions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await revisionsApi.getMyRevisions();
      setRevisions(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createRevision = useCallback(async (studentId: string, surahId: number, scheduledFor: string) => {
    const created = await revisionsApi.createRevision(studentId, surahId, scheduledFor);
    setRevisions((prev) => [created, ...prev]);
    return created;
  }, []);

  const markRevision = useCallback(async (id: string, status: 'COMPLETED' | 'MISSED') => {
    const updated = await revisionsApi.markRevision(id, status);
    setRevisions((prev) => prev.map((r) => (r.id === id ? updated : r)));
    return updated;
  }, []);

  const removeRevision = useCallback(async (id: string) => {
    await revisionsApi.deleteRevision(id);
    setRevisions((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return { revisions, isLoading, error, fetchRevisions, createRevision, markRevision, removeRevision };
}
