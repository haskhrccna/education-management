import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { certificatesApi, Certificate } from '../api/certificates';
import { secureStorage } from '../storage/secureStorage';

export function useCertificates(studentId?: string) {
  const q = useQuery<Certificate[]>({
    queryKey: ['certificates', studentId ?? 'me'],
    queryFn: () => certificatesApi.list(studentId),
  });

  const fetchCertificates = useCallback(async () => {
    await q.refetch();
  }, [q.refetch]);

  const getDownloadUrl = useCallback(async (certId: string) => {
    const token = await secureStorage.getItem('auth_token');
    return certificatesApi.downloadUrl(certId, token ?? '');
  }, []);

  return {
    certificates: q.data ?? [],
    isLoading: q.isLoading,
    error: q.error ? (q.error as Error).message : null,
    fetchCertificates,
    getDownloadUrl,
  };
}
