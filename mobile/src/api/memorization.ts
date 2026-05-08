import apiClient from './client';

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
    const res = await apiClient.get('/memorization');
    return res.data;
  },

  getStudentProgress: async (studentId: string): Promise<MemorizationEntry[]> => {
    const res = await apiClient.get('/memorization', { params: { studentId } });
    return res.data;
  },

  updateProgress: async (
    surahId: number,
    studentId: string,
    memorizedAyahs: number,
    status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE'
  ): Promise<MemorizationEntry> => {
    const res = await apiClient.put(`/memorization/${surahId}`, { studentId, memorizedAyahs, status });
    return res.data;
  },

  getSurahs: async (): Promise<Surah[]> => {
    const res = await apiClient.get('/surahs');
    return res.data;
  },
};
