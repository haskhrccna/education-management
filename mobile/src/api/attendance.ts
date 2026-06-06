// Phase 2 — Attendance + Session Completion: mobile API client
//
// TODO(phase2-mobile): P0 #2 (broken `apiClient` export in ./client.ts) must be
// fixed before this file can be imported. Once `client.ts` exposes a default
// axios instance, replace the throw below with the real client.
//
// Endpoint contract (already implemented on the server, see
// packages/server/src/routes/appointment.routes.ts and attendance.routes.ts):
//   POST  /appointments/:id/attendance       body { status, notes? }   (TEACHER)
//   GET   /attendance?studentId=            -> SessionRecord[]

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

function notWired() {
  throw new Error(
    'mobile/src/api/attendance.ts: not yet wired — waiting on P0 #2 fix in ./client.ts'
  );
}

export const attendanceApi = {
  record: async (
    _appointmentId: string,
    _status: AttendanceStatus,
    _notes?: string
  ): Promise<SessionRecord> => notWired(),
  list: async (_studentId?: string): Promise<SessionRecord[]> => notWired(),
};
