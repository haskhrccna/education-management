import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { gamificationApi, MyGamification, LeaderboardEntry } from '../api/gamification';

export function useGamification() {
  const [scope, setScope] = useState<string>('all');

  const mineQ = useQuery<MyGamification>({
    queryKey: ['gamification', 'mine'],
    queryFn: () => gamificationApi.getMine(),
  });

  const lbQ = useQuery<LeaderboardEntry[]>({
    queryKey: ['gamification', 'leaderboard', scope],
    queryFn: () => gamificationApi.getLeaderboard(scope),
  });

  const fetchGamification = useCallback(async () => {
    await mineQ.refetch();
  }, [mineQ.refetch]);

  // Switching scope re-keys the leaderboard query, which fetches (or serves cache).
  const fetchLeaderboard = useCallback(async (s?: string) => {
    setScope(s ?? 'all');
  }, []);

  return {
    gamification: mineQ.data ?? null,
    leaderboard: lbQ.data ?? [],
    leaderboardLoading: lbQ.isLoading,
    leaderboardError: lbQ.error ? (lbQ.error as Error).message : null,
    isLoading: mineQ.isLoading,
    error: mineQ.error ? (mineQ.error as Error).message : null,
    fetchGamification,
    fetchLeaderboard,
  };
}
