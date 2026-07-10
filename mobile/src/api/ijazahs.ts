import { ijazahsContracts } from '@quran-review/shared';
import { contractClient, expectStatus, API_ORIGIN } from './contract';

export type IjazahScope = 'SURAH' | 'JUZ' | 'FULL_QURAN';

export interface Ijazah {
  id: string;
  studentId: string;
  teacherId: string;
  scope: IjazahScope;
  surahId: number | null;
  juzNumber: number | null;
  teacherChainRef: string | null;
  chainIjazahId: string | null;
  issuedAt: string;
  verificationToken: string;
  active: boolean;
  surah?: { id: number; nameAr: string; nameEn: string } | null;
  teacher?: { id: string; firstName: string; lastName: string };
  student?: { id: string; firstName: string; lastName: string };
}

export const ijazahsApi = {
  issue: async (
    studentId: string,
    scope: IjazahScope,
    opts: { surahId?: number; juzNumber?: number; teacherChainRef?: string; chainIjazahId?: string } = {}
  ): Promise<Ijazah> => {
    const res = expectStatus(
      await contractClient.call(ijazahsContracts.issue, { body: { studentId, scope, ...opts } as never }),
      201
    );
    return (res.body as unknown as { data: Ijazah }).data;
  },

  list: async (): Promise<Ijazah[]> => {
    const res = expectStatus(await contractClient.call(ijazahsContracts.list), 200);
    return (res.body as unknown as { data: Ijazah[] }).data;
  },

  verifyUrl: (verificationToken: string): string => {
    return `${API_ORIGIN}/api/v1/verify/${verificationToken}`;
  },

  regenerateLink: async (ijazahId: string): Promise<Ijazah> => {
    const res = expectStatus(
      await contractClient.call(ijazahsContracts.regenerateLink, { params: { id: ijazahId } }),
      200
    );
    return (res.body as unknown as { data: Ijazah }).data;
  },
};
