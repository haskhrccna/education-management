import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ijazahsApi, Ijazah, IjazahScope } from '../api/ijazahs';

export function useIjazahs() {
  const qc = useQueryClient();

  const q = useQuery<Ijazah[]>({
    queryKey: ['ijazahs'],
    queryFn: () => ijazahsApi.list(),
  });

  const issue = useCallback(
    async (
      studentId: string,
      scope: IjazahScope,
      opts: { surahId?: number; juzNumber?: number; teacherChainRef?: string; chainIjazahId?: string } = {}
    ) => {
      const record = await ijazahsApi.issue(studentId, scope, opts);
      await qc.invalidateQueries({ queryKey: ['ijazahs'] });
      return record;
    },
    [qc]
  );

  return {
    ijazahs: q.data ?? [],
    isLoading: q.isLoading,
    error: q.error ? (q.error as Error).message : null,
    refetch: q.refetch,
    issue,
  };
}
