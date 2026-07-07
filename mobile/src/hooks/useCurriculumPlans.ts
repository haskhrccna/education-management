import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { curriculumPlansApi, CurriculumPlan } from '../api';

export function useCurriculumPlans() {
  const qc = useQueryClient();

  const q = useQuery<CurriculumPlan[]>({
    queryKey: ['curriculumPlans'],
    queryFn: () => curriculumPlansApi.list(),
  });

  const createPlan = useCallback(
    async (studentId: string, name: string, items: { surahId: number; targetDate: string }[]) => {
      const plan = await curriculumPlansApi.create(studentId, name, items);
      await qc.invalidateQueries({ queryKey: ['curriculumPlans'] });
      return plan;
    },
    [qc]
  );

  return {
    plans: q.data ?? [],
    isLoading: q.isLoading,
    error: q.error ? (q.error as Error).message : null,
    refetch: q.refetch,
    createPlan,
  };
}
