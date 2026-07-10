import { learningContracts } from '@quran-review/shared';
import { contractClient, expectStatus } from './contract';

export interface GradeSurah {
  id: number;
  number: number;
  nameAr: string;
  nameEn: string;
}

export interface Grade {
  id: string;
  studentId: string;
  teacherId: string;
  surahId: number | null;
  surah: GradeSurah | null;
  grade: string;
  type: string;
  notes?: string | null;
  createdAt: string;
}

export const gradesApi = {
  getMine: async (): Promise<Grade[]> => {
    const res = expectStatus(await contractClient.call(learningContracts.listGrades), 200);
    return res.body as unknown as Grade[];
  },

  getStudentGrades: async (studentId: string): Promise<Grade[]> => {
    const res = expectStatus(
      await contractClient.call(learningContracts.studentGrades, { params: { id: studentId } }),
      200
    );
    return res.body as unknown as Grade[];
  },

  create: async (data: { studentId: string; surahId: number | null; grade: string; type: string; notes?: string }) => {
    const res = expectStatus(await contractClient.call(learningContracts.createGrade, { body: data as never }), 201);
    return res.body as unknown as Grade;
  },
};
