import { useCallback, useState, useEffect } from 'react';
import { appointmentsApi, Appointment } from '../api';
import { useSocket } from './useSocket';
import { mmkvStorage } from '../storage/mmkvStorage';

const CACHE_KEY = '@appointments_cache';

export function useAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    const cached = mmkvStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socket = useSocket();

  const fetchAppointments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await appointmentsApi.getMine();
      setAppointments(data);
      mmkvStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Listen for real-time appointment updates
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      fetchAppointments();
    };

    socket.on('appointment_update', handleUpdate);
    return () => {
      socket.off('appointment_update', handleUpdate);
    };
  }, [socket, fetchAppointments]);

  const createAppointment = useCallback(
    async (data: Parameters<typeof appointmentsApi.create>[0]) => {
      setIsLoading(true);
      try {
        const created = await appointmentsApi.create(data);
        setAppointments((prev) => [created, ...prev]);
        // Update cache
        mmkvStorage.setItem(CACHE_KEY, JSON.stringify([created, ...appointments]));
        return created;
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [appointments]
  );

  return { appointments, isLoading, error, fetchAppointments, createAppointment };
}
