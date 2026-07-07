import apiClient from './client';

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
    const res = await apiClient.post('/weak-ayahs', { studentId, ayahId });
    return res.data.data;
  },

  list: async (): Promise<WeakAyahFlag[]> => {
    const res = await apiClient.get('/weak-ayahs');
    return res.data?.data ?? [];
  },
};
