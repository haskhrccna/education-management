import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { halaqaApi, HalaqaRoom, HalaqaStatus } from '../api/halaqa';

export function useHalaqa() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<HalaqaStatus | undefined>(undefined);
  const key = ['halaqa', status ?? 'all'];

  const q = useQuery<HalaqaRoom[]>({ queryKey: key, queryFn: () => halaqaApi.list(status) });

  const fetchRooms = useCallback(
    async (s?: HalaqaStatus) => {
      setStatus(s);
      await qc.invalidateQueries({ queryKey: ['halaqa'] });
    },
    [qc]
  );

  const createRoom = useCallback(
    async (title: string, groupId?: string) => {
      const room = await halaqaApi.create(title, groupId);
      qc.setQueryData<HalaqaRoom[]>(['halaqa', status ?? 'all'], (p) => [room, ...(p ?? [])]);
      return room;
    },
    [qc, status]
  );

  const startRoom = useCallback(
    async (id: string) => {
      const room = await halaqaApi.start(id);
      qc.setQueryData<HalaqaRoom[]>(['halaqa', status ?? 'all'], (p) => (p ?? []).map((r) => (r.id === id ? room : r)));
      return room;
    },
    [qc, status]
  );

  const endRoom = useCallback(
    async (id: string) => {
      const room = await halaqaApi.end(id);
      qc.setQueryData<HalaqaRoom[]>(['halaqa', status ?? 'all'], (p) => (p ?? []).map((r) => (r.id === id ? room : r)));
      return room;
    },
    [qc, status]
  );

  return {
    rooms: q.data ?? [],
    isLoading: q.isLoading,
    error: q.error ? (q.error as Error).message : null,
    fetchRooms,
    createRoom,
    startRoom,
    endRoom,
  };
}
