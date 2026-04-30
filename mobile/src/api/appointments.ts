import apiClient from './client';

export interface Appointment {
  id: string;
  studentId: string;
  teacherId: string;
  requestedDate: string;
  requestedTime: string;
  durationMinutes: number;
  status: string;
  teacher?: { id: string; firstName: string; lastName: string; email: string };
  student?: { id: string; firstName: string; lastName: string; email: string };
}

export const appointmentsApi = {
  getMine: async (): Promise<Appointment[]> => {
    const res = await apiClient.get('/appointments');
    return res.data;
  },

  create: async (data: {
    teacherId: string;
    requestedDate: string;
    requestedTime: string;
    durationMinutes?: number;
  }) => {
    const res = await apiClient.post('/appointments', data);
    return res.data;
  },

  manage: async (id: string, action: string, amendedNote?: string) => {
    const res = await apiClient.put(`/appointments/${id}`, { action, amendedNote });
    return res.data;
  },
};
