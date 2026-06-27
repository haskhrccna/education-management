import { useCallback, useEffect, useState } from 'react';
import { analyticsApi, AdminAnalytics } from '../api/analytics';

export function useAnalytics() {
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await analyticsApi.getAdminAnalytics();
      setAnalytics(data);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return { analytics, isLoading, error, fetchAnalytics };
}
