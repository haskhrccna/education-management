import { useQuery } from '@tanstack/react-query';
import { academyHealthApi } from '../api/academyHealth';

export function useAcademyHealth() {
  const query = useQuery({
    queryKey: ['academy-health'],
    // staleTime matches the server's 1h Redis cache being the real source of truth —
    // refetching more often than that just re-reads the same cached aggregate.
    queryFn: academyHealthApi.get,
    staleTime: 5 * 60 * 1000,
  });
  return {
    metrics: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refetch: query.refetch,
  };
}
