// Phase 2 — Attendance + Session Completion: mobile API client
import apiClient from './client';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export interface SessionRecord {
  id: string;
  appointmentId: string;
  studentId: string;
  teacherId: string;
  status: AttendanceStatus;
  notes: string | null;
  recordedAt: string;
  appointment?: {
    requestedDate: string;
    requestedTime: string;
    durationMinutes: number;
  };
}

export const attendanceApi = {
  record: async (appointmentId: string, status: AttendanceStatus, notes?: string): Promise<SessionRecord> => {
    const { data } = await apiClient.post(`/appointments/${appointmentId}/attendance`, { status, notes });
    return data;
  },
  list: async (studentId?: string): Promise<SessionRecord[]> => {
    const { data } = await apiClient.get('/attendance', { params: studentId ? { studentId } : undefined });
    return data;
  },
};
