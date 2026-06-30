import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { memorizationApi, MemorizationEntry, Surah } from '../api';

function computeStreak(entries: MemorizationEntry[]): number {
  const activeDates = new Set(
    entries
      .map((e) => e.lastRecitedAt)
      .filter(Boolean)
      .map((d) => new Date(d!).toISOString().split('T')[0])
  );
  if (activeDates.size === 0) return 0;
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    if (activeDates.has(date.toISOString().split('T')[0])) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export function useMemorization() {
  const q = useQuery<{ progress: MemorizationEntry[]; surahs: Surah[] }>({
    queryKey: ['memorization'],
    queryFn: async () => {
      const [progress, surahs] = await Promise.all([memorizationApi.getMine(), memorizationApi.getSurahs()]);
      return { progress, surahs };
    },
  });

  const fetchProgress = useCallback(async () => {
    await q.refetch();
  }, [q.refetch]);

  const progress = q.data?.progress ?? [];
  const surahs = q.data?.surahs ?? [];
  const streak = useMemo(() => computeStreak(progress), [progress]);

  return {
    progress,
    surahs,
    isLoading: q.isLoading,
    error: q.error ? (q.error as Error).message : null,
    fetchProgress,
    streak,
  };
}
