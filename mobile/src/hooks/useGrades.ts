import { useCallback, useState } from 'react';
import { gradesApi, Grade } from '../api';

export function useGrades() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGrades = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await gradesApi.getMine();
      setGrades(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { grades, isLoading, error, fetchGrades };
}
