import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { halaqaGroupsApi, HalaqaGroup } from '../api/halaqa';

export function useHalaqaGroups() {
  const qc = useQueryClient();
  const q = useQuery<HalaqaGroup[]>({ queryKey: ['halaqaGroups'], queryFn: () => halaqaGroupsApi.list() });

  const createGroup = useCallback(
    async (title: string, attendanceThreshold: number) => {
      const group = await halaqaGroupsApi.create(title, attendanceThreshold);
      await qc.invalidateQueries({ queryKey: ['halaqaGroups'] });
      return group;
    },
    [qc]
  );

  return {
    groups: q.data ?? [],
    isLoading: q.isLoading,
    error: q.error ? (q.error as Error).message : null,
    refetch: q.refetch,
    createGroup,
  };
}

/** Fetches a single group by id — used on the room screen to show its collective streak. */
export function useHalaqaGroup(groupId: string | null | undefined) {
  const q = useQuery<HalaqaGroup>({
    queryKey: ['halaqaGroup', groupId],
    queryFn: () => halaqaGroupsApi.get(groupId as string),
    enabled: !!groupId,
  });
  return { group: q.data ?? null, isLoading: q.isLoading };
}
