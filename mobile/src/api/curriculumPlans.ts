import { curriculumPlansContracts } from '@quran-review/shared';
import { contractClient, expectStatus } from './contract';

export interface PlanItem {
  id: string;
  surahId: number;
  targetDate: string;
  order: number;
  surah?: { id: number; nameAr: string; nameEn: string };
}

export interface CurriculumPlan {
  id: string;
  studentId: string;
  teacherId: string;
  name: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  items: PlanItem[];
  pace: 'ON_PACE' | 'BEHIND' | 'AHEAD';
}

export const curriculumPlansApi = {
  create: async (
    studentId: string,
    name: string,
    items: { surahId: number; targetDate: string }[]
  ): Promise<CurriculumPlan> => {
    const res = expectStatus(
      await contractClient.call(curriculumPlansContracts.create, { body: { studentId, name, items } as never }),
      201
    );
    return (res.body as unknown as { data: CurriculumPlan }).data;
  },

  list: async (): Promise<CurriculumPlan[]> => {
    const res = expectStatus(await contractClient.call(curriculumPlansContracts.list), 200);
    return (res.body as unknown as { data: CurriculumPlan[] }).data;
  },
};
