import apiClient from './client';

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
    const res = await apiClient.post('/ijazahs', { studentId, scope, ...opts });
    return res.data.data;
  },

  list: async (): Promise<Ijazah[]> => {
    const res = await apiClient.get('/ijazahs');
    return res.data?.data ?? [];
  },

  verifyUrl: (verificationToken: string): string => {
    const baseURL = apiClient.defaults.baseURL || '';
    return `${baseURL}/verify/${verificationToken}`;
  },

  regenerateLink: async (ijazahId: string): Promise<Ijazah> => {
    const res = await apiClient.patch(`/ijazahs/${ijazahId}/regenerate-link`);
    return res.data.data;
  },
};
