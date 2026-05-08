import { useState, useCallback } from 'react';
import { teacherChangeApi } from '../api/teacherChange';

export function useTeacherChange() {
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async (status?: 'PENDING') => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await teacherChangeApi.list(status);
      setRequests(data);
    } catch {
      setError('Failed to load requests');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const submitRequest = useCallback(async (reason: string) => {
    await teacherChangeApi.submit(reason);
  }, []);

  const decideRequest = useCallback(async (id: string, action: 'APPROVE' | 'DENY', adminNote?: string) => {
    await teacherChangeApi.decide(id, action, adminNote);
    await fetchRequests();
  }, [fetchRequests]);

  return { requests, isLoading, error, fetchRequests, submitRequest, decideRequest };
}
