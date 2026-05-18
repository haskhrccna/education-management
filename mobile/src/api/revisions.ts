import apiClient from './client';

export interface Revision {
  id: string;
  userId: string;
  surahId: number;
  scheduledFor: string;
  status: 'PENDING' | 'COMPLETED' | 'MISSED';
  surah?: { id: number; name: string; englishName: string; juzNumber: number };
}

export const revisionsApi = {
  getMyRevisions: async (): Promise<Revision[]> => {
    const res = await apiClient.get('/revisions');
    return res.data;
  },

  createRevision: async (studentId: string, surahId: number, scheduledFor: string): Promise<Revision> => {
    const res = await apiClient.post('/revisions', { studentId, surahId, scheduledFor });
    return res.data;
  },

  markRevision: async (id: string, status: 'COMPLETED' | 'MISSED'): Promise<Revision> => {
    const res = await apiClient.put(`/revisions/${id}`, { status });
    return res.data;
  },

  deleteRevision: async (id: string): Promise<void> => {
    await apiClient.delete(`/revisions/${id}`);
  },
};
