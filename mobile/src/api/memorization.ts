import { learningContracts } from '@quran-review/shared';
import { contractClient, expectStatus } from './contract';

export interface MemorizationEntry {
  surahId: number;
  memorizedAyahs: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE';
  lastRecitedAt?: string;
  surah: { number: number; nameAr: string; nameEn: string; ayahCount: number; juz: number };
}

export interface Surah {
  id: number;
  number: number;
  nameAr: string;
  nameEn: string;
  ayahCount: number;
  juz: number;
}

export const memorizationApi = {
  getMine: async (): Promise<MemorizationEntry[]> => {
    const res = expectStatus(await contractClient.call(learningContracts.getMemorization), 200);
    return res.body as unknown as MemorizationEntry[];
  },

  getStudentProgress: async (studentId: string): Promise<MemorizationEntry[]> => {
    const res = expectStatus(
      await contractClient.call(learningContracts.getMemorization, { query: { studentId } as never }),
      200
    );
    return res.body as unknown as MemorizationEntry[];
  },

  updateProgress: async (
    surahId: number,
    studentId: string,
    memorizedAyahs: number,
    status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE'
  ): Promise<MemorizationEntry> => {
    const res = expectStatus(
      await contractClient.call(learningContracts.updateMemorization, {
        params: { surahId: String(surahId) } as never,
        body: { studentId, memorizedAyahs, status } as never,
      }),
      200
    );
    return res.body as unknown as MemorizationEntry;
  },

  getSurahs: async (): Promise<Surah[]> => {
    const res = expectStatus(await contractClient.call(learningContracts.listSurahs), 200);
    return res.body as unknown as Surah[];
  },
};
