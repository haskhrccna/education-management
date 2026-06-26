import { useCallback, useState } from 'react';
import { gradesApi, Grade } from '../api';
import { mmkvStorage } from '../storage/mmkvStorage';

const CACHE_KEY = '@grades_cache';

export function useGrades() {
  const [grades, setGrades] = useState<Grade[]>(() => {
    const cached = mmkvStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGrades = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await gradesApi.getMine();
      setGrades(data);
      mmkvStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { grades, isLoading, error, fetchGrades };
}
