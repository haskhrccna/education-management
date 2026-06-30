import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { appointmentsApi, Appointment } from '../api';
import { useSocket } from './useSocket';

const KEY = ['appointments'];

export function useAppointments() {
  const qc = useQueryClient();
  const socket = useSocket();
  const [actionError, setActionError] = useState<string | null>(null);
  const q = useQuery<Appointment[]>({ queryKey: KEY, queryFn: () => appointmentsApi.getMine() });

  // Real-time appointment updates → refetch via cache invalidation.
  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => qc.invalidateQueries({ queryKey: KEY });
    socket.on('appointment_update', handleUpdate);
    return () => {
      socket.off('appointment_update', handleUpdate);
    };
  }, [socket, qc]);

  const fetchAppointments = useCallback(async () => {
    await q.refetch();
  }, [q.refetch]);

  const createAppointment = useCallback(
    async (data: Parameters<typeof appointmentsApi.create>[0]) => {
      setActionError(null);
      try {
        const created = await appointmentsApi.create(data);
        qc.setQueryData<Appointment[]>(KEY, (prev) => [created, ...(prev ?? [])]);
        return created;
      } catch (err: any) {
        setActionError(err.message);
        throw err;
      }
    },
    [qc]
  );

  return {
    appointments: q.data ?? [],
    isLoading: q.isLoading,
    error: q.error ? (q.error as Error).message : actionError,
    fetchAppointments,
    createAppointment,
  };
}
