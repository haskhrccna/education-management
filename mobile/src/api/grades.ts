import apiClient from './client';

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
    const res = await apiClient.get('/grades');
    return res.data;
  },

  getStudentGrades: async (studentId: string): Promise<Grade[]> => {
    const res = await apiClient.get(`/grades/student/${studentId}`);
    return res.data;
  },

  create: async (data: { studentId: string; surahId: number | null; grade: string; type: string; notes?: string }) => {
    const res = await apiClient.post('/grades', data);
    return res.data;
  },
};
