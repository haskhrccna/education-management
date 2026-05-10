import { useCallback, useMemo, useState } from 'react';
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
  const [progress, setProgress] = useState<MemorizationEntry[]>([]);
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [progressData, surahsData] = await Promise.all([memorizationApi.getMine(), memorizationApi.getSurahs()]);
      setProgress(progressData);
      setSurahs(surahsData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const streak = useMemo(() => computeStreak(progress), [progress]);

  return { progress, surahs, isLoading, error, fetchProgress, streak };
}
