import { useCallback, useState } from 'react';
import { appointmentsApi, Appointment } from '../api';

export function useAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await appointmentsApi.getMine();
      setAppointments(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createAppointment = useCallback(async (data: Parameters<typeof appointmentsApi.create>[0]) => {
    setIsLoading(true);
    try {
      const created = await appointmentsApi.create(data);
      setAppointments((prev) => [created, ...prev]);
      return created;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { appointments, isLoading, error, fetchAppointments, createAppointment };
}
