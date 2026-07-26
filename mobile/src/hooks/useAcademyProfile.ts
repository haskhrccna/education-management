import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { academyProfileApi } from '../api/academyProfile';
import type { ZodUpsertAcademyProfileInput } from '@quran-review/shared';

export function useAcademyProfile() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['academy-profile'], queryFn: academyProfileApi.get });
  const save = useMutation({
    mutationFn: (input: ZodUpsertAcademyProfileInput) => academyProfileApi.upsert(input),
    onSuccess: (data) => qc.setQueryData(['academy-profile'], data),
  });
  return { profile: query.data ?? null, isLoading: query.isLoading, error: query.error, save };
}
