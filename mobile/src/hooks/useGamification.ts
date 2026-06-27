import { useCallback, useEffect, useState } from 'react';
import { gamificationApi, MyGamification, LeaderboardEntry } from '../api/gamification';

export function useGamification() {
  const [gamification, setGamification] = useState<MyGamification | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGamification = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await gamificationApi.getMine();
      setGamification(data);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load gamification');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchLeaderboard = useCallback(async (scope?: string) => {
    try {
      const data = await gamificationApi.getLeaderboard(scope);
      setLeaderboard(data);
    } catch {
      setLeaderboard([]);
    }
  }, []);

  useEffect(() => {
    fetchGamification();
  }, [fetchGamification]);

  return { gamification, leaderboard, isLoading, error, fetchGamification, fetchLeaderboard };
}
