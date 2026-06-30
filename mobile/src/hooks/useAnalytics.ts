import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi, AdminAnalytics } from '../api/analytics';

export function useAnalytics() {
  const q = useQuery<AdminAnalytics>({
    queryKey: ['analytics', 'admin'],
    queryFn: () => analyticsApi.getAdminAnalytics(),
  });
  const fetchAnalytics = useCallback(async () => {
    await q.refetch();
  }, [q.refetch]);
  return {
    analytics: q.data ?? null,
    isLoading: q.isLoading,
    error: q.error ? (q.error as Error).message : null,
    fetchAnalytics,
  };
}
