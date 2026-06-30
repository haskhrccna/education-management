import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { teacherChangeApi } from '../api/teacherChange';

export function useTeacherChange() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<'PENDING' | undefined>(undefined);

  const q = useQuery<any[]>({
    queryKey: ['teacherChange', status ?? 'all'],
    queryFn: () => teacherChangeApi.list(status),
  });

  const fetchRequests = useCallback(
    async (s?: 'PENDING') => {
      setStatus(s);
      await qc.invalidateQueries({ queryKey: ['teacherChange'] });
    },
    [qc]
  );

  const submitRequest = useCallback(async (reason: string) => {
    await teacherChangeApi.submit(reason);
  }, []);

  const decideRequest = useCallback(
    async (id: string, action: 'APPROVE' | 'DENY', adminNote?: string, newTeacherId?: string) => {
      await teacherChangeApi.decide(id, action, adminNote, newTeacherId);
      await qc.invalidateQueries({ queryKey: ['teacherChange'] });
    },
    [qc]
  );

  const fetchTeachers = useCallback(async () => {
    return teacherChangeApi.listTeachers();
  }, []);

  return {
    requests: q.data ?? [],
    isLoading: q.isLoading,
    error: q.error ? (q.error as Error).message : null,
    fetchRequests,
    submitRequest,
    decideRequest,
    fetchTeachers,
  };
}
