import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { certificatesApi, Certificate } from '../api/certificates';
import { secureStorage } from '../storage/secureStorage';

export function useCertificates(studentId?: string) {
  const qc = useQueryClient();
  const queryKey = ['certificates', studentId ?? 'me'];
  const q = useQuery<Certificate[]>({
    queryKey,
    queryFn: () => certificatesApi.list(studentId),
  });

  const fetchCertificates = useCallback(async () => {
    await q.refetch();
  }, [q.refetch]);

  const getDownloadUrl = useCallback(async (certId: string) => {
    const token = await secureStorage.getItem('auth_token');
    return certificatesApi.downloadUrl(certId, token ?? '');
  }, []);

  const getVerifyUrl = useCallback((verificationToken: string) => certificatesApi.verifyUrl(verificationToken), []);

  const regenerateLink = useCallback(
    async (certId: string) => {
      const updated = await certificatesApi.regenerateLink(certId);
      await qc.invalidateQueries({ queryKey: ['certificates', studentId ?? 'me'] });
      return updated;
    },
    [qc, studentId]
  );

  return {
    certificates: q.data ?? [],
    isLoading: q.isLoading,
    error: q.error ? (q.error as Error).message : null,
    fetchCertificates,
    getDownloadUrl,
    getVerifyUrl,
    regenerateLink,
  };
}
