import { certificatesContracts } from '@quran-review/shared';
import { contractClient, expectStatus, API_ORIGIN } from './contract';

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
    const res = expectStatus(
      await contractClient.call(certificatesContracts.listCertificates, {
        query: studentId ? ({ studentId } as never) : undefined,
      }),
      200
    );
    return (res.body as unknown as { data: Certificate[] }).data;
  },
  downloadUrl: (certId: string, token: string): string => {
    return `${API_ORIGIN}/api/v1/files/certificates/${certId}?token=${encodeURIComponent(token)}`;
  },
  verifyUrl: (verificationToken: string): string => {
    return `${API_ORIGIN}/api/v1/verify/${verificationToken}`;
  },
  regenerateLink: async (certId: string): Promise<Certificate> => {
    const res = expectStatus(
      await contractClient.call(certificatesContracts.regenerateLink, { params: { id: certId } }),
      200
    );
    return (res.body as unknown as { data: Certificate }).data;
  },
};
