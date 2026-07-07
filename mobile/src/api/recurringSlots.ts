import apiClient from './client';

export interface RecurringSlot {
  id: string;
  studentId: string;
  teacherId: string;
  dayOfWeek: number;
  time: string;
  durationMinutes: number;
  active: boolean;
}

export interface GeneratedOccurrence {
  date: string;
  created: boolean;
  appointmentId?: string;
  skippedReason?: string;
}

export const recurringSlotsApi = {
  create: async (
    teacherId: string,
    dayOfWeek: number,
    time: string,
    durationMinutes?: number
  ): Promise<{ slot: RecurringSlot; occurrences: GeneratedOccurrence[] }> => {
    const res = await apiClient.post('/recurring-slots', { teacherId, dayOfWeek, time, durationMinutes });
    return res.data.data;
  },

  list: async (): Promise<RecurringSlot[]> => {
    const res = await apiClient.get('/recurring-slots');
    return res.data?.data ?? [];
  },

  cancel: async (id: string): Promise<RecurringSlot> => {
    const res = await apiClient.patch(`/recurring-slots/${id}/cancel`);
    return res.data.data;
  },
};
