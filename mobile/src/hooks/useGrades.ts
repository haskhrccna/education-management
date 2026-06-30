import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { gradesApi, Grade } from '../api';

export function useGrades() {
  const q = useQuery<Grade[]>({ queryKey: ['grades'], queryFn: () => gradesApi.getMine() });
  const fetchGrades = useCallback(async () => {
    await q.refetch();
  }, [q.refetch]);
  return {
    grades: q.data ?? [],
    isLoading: q.isLoading,
    error: q.error ? (q.error as Error).message : null,
    fetchGrades,
  };
}
