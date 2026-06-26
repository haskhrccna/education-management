import { useCallback, useState } from 'react';
import { recordingsApi, Recording } from '../api';
import { mmkvStorage } from '../storage/mmkvStorage';

const CACHE_KEY = '@recordings_cache';

export function useRecordings() {
  const [recordings, setRecordings] = useState<Recording[]>(() => {
    const cached = mmkvStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await recordingsApi.getRecordings();
      setRecordings(data);
      mmkvStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load recordings');
    } finally {
      setLoading(false);
    }
  }, []);

  const upload = useCallback(
    async (formData: FormData): Promise<Recording | null> => {
      setError(null);
      try {
        const created = await recordingsApi.uploadRecording(formData);
        const updatedRecordings = [created, ...recordings];
        setRecordings(updatedRecordings);
        mmkvStorage.setItem(CACHE_KEY, JSON.stringify(updatedRecordings));
        return created;
      } catch (err: any) {
        setError(err?.response?.data?.message ?? err?.message ?? 'Upload failed');
        return null;
      }
    },
    [recordings]
  );

  const review = useCallback(
    async (id: string, approved: boolean, notes?: string): Promise<Recording | null> => {
      setError(null);
      try {
        const updated = await recordingsApi.reviewRecording(id, { approved, notes });
        const updatedRecordings = recordings.map((r) => (r.id === id ? { ...r, ...updated } : r));
        setRecordings(updatedRecordings);
        mmkvStorage.setItem(CACHE_KEY, JSON.stringify(updatedRecordings));
        return updated;
      } catch (err: any) {
        setError(err?.response?.data?.message ?? err?.message ?? 'Review failed');
        return null;
      }
    },
    [recordings]
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      setError(null);
      try {
        await recordingsApi.deleteRecording(id);
        const updatedRecordings = recordings.filter((r) => r.id !== id);
        setRecordings(updatedRecordings);
        mmkvStorage.setItem(CACHE_KEY, JSON.stringify(updatedRecordings));
        return true;
      } catch (err: any) {
        setError(err?.response?.data?.message ?? err?.message ?? 'Delete failed');
        return false;
      }
    },
    [recordings]
  );

  return { recordings, loading, error, refresh, upload, review, remove };
}
