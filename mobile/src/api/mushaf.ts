import apiClient from './client';
import type { SurahWithAyahsDTO, MushafPageDTO } from '@quran-review/shared';

export const mushafApi = {
  getSurah: async (id: number): Promise<SurahWithAyahsDTO> => {
    const res = await apiClient.get(`/mushaf/surahs/${id}`);
    return res.data?.data ?? res.data;
  },
  getPage: async (page: number): Promise<MushafPageDTO> => {
    const res = await apiClient.get(`/mushaf/pages/${page}`);
    return res.data?.data ?? res.data;
  },
  logMemorization: async (surahId: number, ayahNumber: number, memorized: boolean) => {
    await apiClient.post('/mushaf/log-memorization', { surahId, ayahNumber, memorized });
  },
};
