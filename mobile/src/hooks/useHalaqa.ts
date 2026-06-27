import { useCallback, useEffect, useState } from 'react';
import { halaqaApi, HalaqaRoom, HalaqaStatus } from '../api/halaqa';

export function useHalaqa() {
  const [rooms, setRooms] = useState<HalaqaRoom[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRooms = useCallback(async (status?: HalaqaStatus) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await halaqaApi.list(status);
      setRooms(data);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load rooms');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createRoom = useCallback(async (title: string) => {
    const room = await halaqaApi.create(title);
    setRooms((prev) => [room, ...prev]);
    return room;
  }, []);

  const startRoom = useCallback(async (id: string) => {
    const room = await halaqaApi.start(id);
    setRooms((prev) => prev.map((r) => (r.id === id ? room : r)));
    return room;
  }, []);

  const endRoom = useCallback(async (id: string) => {
    const room = await halaqaApi.end(id);
    setRooms((prev) => prev.map((r) => (r.id === id ? room : r)));
    return room;
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  return { rooms, isLoading, error, fetchRooms, createRoom, startRoom, endRoom };
}
