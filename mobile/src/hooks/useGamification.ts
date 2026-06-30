import { useCallback, useEffect, useState } from 'react';
import { gamificationApi, MyGamification, LeaderboardEntry } from '../api/gamification';

export function useGamification() {
  const [gamification, setGamification] = useState<MyGamification | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);

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
    setLeaderboardLoading(true);
    setLeaderboardError(null);
    try {
      const data = await gamificationApi.getLeaderboard(scope);
      setLeaderboard(data);
    } catch (err: any) {
      setLeaderboardError(err?.message ?? 'Failed to load leaderboard');
      setLeaderboard([]);
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGamification();
  }, [fetchGamification]);

  return {
    gamification,
    leaderboard,
    leaderboardLoading,
    leaderboardError,
    isLoading,
    error,
    fetchGamification,
    fetchLeaderboard,
  };
}
