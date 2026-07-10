import { weakAyahsContracts } from '@quran-review/shared';
import { contractClient, expectStatus } from './contract';

export interface WeakAyahFlag {
  id: string;
  studentId: string;
  ayahId: number;
  flaggedByTeacherId: string | null;
  status: 'ACTIVE' | 'RETIRED';
  consecutiveCorrect: number;
}

export const weakAyahsApi = {
  flag: async (studentId: string, ayahId: number): Promise<WeakAyahFlag> => {
    const res = expectStatus(
      await contractClient.call(weakAyahsContracts.flag, { body: { studentId, ayahId } as never }),
      201
    );
    return (res.body as unknown as { data: WeakAyahFlag }).data;
  },

  list: async (): Promise<WeakAyahFlag[]> => {
    const res = expectStatus(await contractClient.call(weakAyahsContracts.list), 200);
    return (res.body as unknown as { data: WeakAyahFlag[] }).data;
  },
};
