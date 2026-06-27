import { useCallback, useEffect, useState } from 'react';
import { certificatesApi, Certificate } from '../api/certificates';
import { secureStorage } from '../storage/secureStorage';

export function useCertificates(studentId?: string) {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCertificates = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await certificatesApi.list(studentId);
      setCertificates(data);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load certificates');
    } finally {
      setIsLoading(false);
    }
  }, [studentId]);

  const getDownloadUrl = useCallback(async (certId: string) => {
    const token = await secureStorage.getItem('auth_token');
    return certificatesApi.downloadUrl(certId, token ?? '');
  }, []);

  useEffect(() => {
    fetchCertificates();
  }, [fetchCertificates]);

  return { certificates, isLoading, error, fetchCertificates, getDownloadUrl };
}
