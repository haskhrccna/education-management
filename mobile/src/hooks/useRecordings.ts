import { useCallback, useState } from 'react';
import { recordingsApi, Recording } from '../api';

export function useRecordings() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await recordingsApi.getRecordings();
      setRecordings(data);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load recordings');
    } finally {
      setLoading(false);
    }
  }, []);

  const upload = useCallback(async (formData: FormData): Promise<Recording | null> => {
    setError(null);
    try {
      const created = await recordingsApi.uploadRecording(formData);
      setRecordings((prev) => [created, ...prev]);
      return created;
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Upload failed');
      return null;
    }
  }, []);

  const review = useCallback(async (id: string, approved: boolean, notes?: string): Promise<Recording | null> => {
    setError(null);
    try {
      const updated = await recordingsApi.reviewRecording(id, { approved, notes });
      setRecordings((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated } : r)));
      return updated;
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Review failed');
      return null;
    }
  }, []);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    setError(null);
    try {
      await recordingsApi.deleteRecording(id);
      setRecordings((prev) => prev.filter((r) => r.id !== id));
      return true;
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Delete failed');
      return false;
    }
  }, []);

  return { recordings, loading, error, refresh, upload, review, remove };
}
