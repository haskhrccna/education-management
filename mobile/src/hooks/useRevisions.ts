import { useCallback, useState } from 'react';
import { revisionsApi, Revision } from '../api';
import { mmkvStorage } from '../storage/mmkvStorage';

const CACHE_KEY = '@revisions_cache';

export function useRevisions() {
  const [revisions, setRevisions] = useState<Revision[]>(() => {
    const cached = mmkvStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRevisions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await revisionsApi.getMyRevisions();
      setRevisions(data);
      mmkvStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createRevision = useCallback(
    async (studentId: string, surahId: number, scheduledFor: string) => {
      const created = await revisionsApi.createRevision(studentId, surahId, scheduledFor);
      const updatedRevisions = [created, ...revisions];
      setRevisions(updatedRevisions);
      mmkvStorage.setItem(CACHE_KEY, JSON.stringify(updatedRevisions));
      return created;
    },
    [revisions]
  );

  const markRevision = useCallback(
    async (id: string, status: 'COMPLETED' | 'MISSED') => {
      const updated = await revisionsApi.markRevision(id, status);
      const updatedRevisions = revisions.map((r) => (r.id === id ? updated : r));
      setRevisions(updatedRevisions);
      mmkvStorage.setItem(CACHE_KEY, JSON.stringify(updatedRevisions));
      return updated;
    },
    [revisions]
  );

  const removeRevision = useCallback(
    async (id: string) => {
      await revisionsApi.deleteRevision(id);
      const updatedRevisions = revisions.filter((r) => r.id !== id);
      setRevisions(updatedRevisions);
      mmkvStorage.setItem(CACHE_KEY, JSON.stringify(updatedRevisions));
    },
    [revisions]
  );

  return { revisions, isLoading, error, fetchRevisions, createRevision, markRevision, removeRevision };
}
