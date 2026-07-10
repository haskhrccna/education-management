// Phase 2 — Attendance + Session Completion: mobile API client
import { schedulingContracts } from '@quran-review/shared';
import { contractClient, expectStatus } from './contract';

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
    const res = expectStatus(
      await contractClient.call(schedulingContracts.recordAttendance, {
        params: { id: appointmentId },
        body: { status, notes } as never,
      }),
      201
    );
    // Fidelity: the axios version returned the whole response body (the
    // {success,data} envelope) typed as SessionRecord — preserved as-is.
    return res.body as unknown as SessionRecord;
  },
  list: async (studentId?: string): Promise<SessionRecord[]> => {
    const res = expectStatus(
      await contractClient.call(schedulingContracts.listAttendance, {
        query: studentId ? ({ studentId } as never) : undefined,
      }),
      200
    );
    return res.body as unknown as SessionRecord[];
  },
};
