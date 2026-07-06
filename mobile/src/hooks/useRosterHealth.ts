import { useQuery } from '@tanstack/react-query';
import { rosterApi, RosterHealthRow } from '../api';

export function useRosterHealth() {
  const q = useQuery<RosterHealthRow[]>({
    queryKey: ['rosterHealth'],
    queryFn: () => rosterApi.getHealth(),
  });

  const atRisk = (q.data ?? []).filter((row) => row.atRisk);

  return {
    roster: q.data ?? [],
    atRisk,
    isLoading: q.isLoading,
    error: q.error ? (q.error as Error).message : null,
    refetch: q.refetch,
  };
}
