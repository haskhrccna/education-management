import { useCallback, useState } from 'react';
import { memorizationApi, MemorizationEntry, Surah } from '../api';

export function useMemorization() {
  const [progress, setProgress] = useState<MemorizationEntry[]>([]);
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [progressData, surahsData] = await Promise.all([
        memorizationApi.getMine(),
        memorizationApi.getSurahs(),
      ]);
      setProgress(progressData);
      setSurahs(surahsData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { progress, surahs, isLoading, error, fetchProgress };
}
