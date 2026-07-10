import { mushafContracts } from '@quran-review/shared';
import type { SurahWithAyahsDTO, MushafPageDTO } from '@quran-review/shared';
import { contractClient, expectStatus } from './contract';

export const mushafApi = {
  getSurah: async (id: number): Promise<SurahWithAyahsDTO> => {
    const res = expectStatus(
      await contractClient.call(mushafContracts.surahAyahs, { params: { id: String(id) } as never }),
      200
    );
    return (res.body as unknown as { data: SurahWithAyahsDTO }).data;
  },
  getPage: async (page: number): Promise<MushafPageDTO> => {
    const res = expectStatus(
      await contractClient.call(mushafContracts.page, { params: { page: String(page) } as never }),
      200
    );
    return (res.body as unknown as { data: MushafPageDTO }).data;
  },
  logMemorization: async (surahId: number, ayahNumber: number, memorized: boolean) => {
    expectStatus(
      await contractClient.call(mushafContracts.logMemorization, {
        body: { surahId, ayahNumber, memorized } as never,
      }),
      200
    );
  },
};
