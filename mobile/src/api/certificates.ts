import apiClient from './client';

export interface Certificate {
  id: string;
  studentId: string;
  pdfUrl: string;
  issuedAt: string;
  verificationToken: string;
  active: boolean;
  student?: { firstName: string; lastName: string };
}

export const certificatesApi = {
  list: async (studentId?: string): Promise<Certificate[]> => {
    const params: Record<string, string> = {};
    if (studentId) params.studentId = studentId;
    const res = await apiClient.get('/certificates', { params });
    return res.data?.data ?? res.data;
  },
  downloadUrl: (certId: string, token: string): string => {
    const baseURL = apiClient.defaults.baseURL || '';
    return `${baseURL}/files/certificates/${certId}?token=${encodeURIComponent(token)}`;
  },
  verifyUrl: (verificationToken: string): string => {
    const baseURL = apiClient.defaults.baseURL || '';
    return `${baseURL}/verify/${verificationToken}`;
  },
  regenerateLink: async (certId: string): Promise<Certificate> => {
    const res = await apiClient.patch(`/certificates/${certId}/regenerate-link`);
    return res.data.data;
  },
};
