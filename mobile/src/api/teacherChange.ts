import apiClient from './client';

export const teacherChangeApi = {
  submit: async (reason: string) => {
    const res = await apiClient.post('/teacher-changes', { reason });
    return res.data;
  },
  list: async (status?: 'PENDING' | 'APPROVED' | 'DENIED') => {
    const res = await apiClient.get('/teacher-changes', { params: status ? { status } : {} });
    return res.data;
  },
  decide: async (id: string, action: 'APPROVE' | 'DENY', adminNote?: string, newTeacherId?: string) => {
    const res = await apiClient.patch(`/teacher-changes/${id}`, { action, adminNote, newTeacherId });
    return res.data;
  },
  listTeachers: async (): Promise<{ id: string; firstName: string; lastName: string }[]> => {
    const res = await apiClient.get('/users/teachers');
    return res.data;
  },
};
