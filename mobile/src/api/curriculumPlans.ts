import apiClient from './client';

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
    const res = await apiClient.post('/curriculum-plans', { studentId, name, items });
    return res.data.data;
  },

  list: async (): Promise<CurriculumPlan[]> => {
    const res = await apiClient.get('/curriculum-plans');
    return res.data?.data ?? [];
  },
};
