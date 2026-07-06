import { schedulingContracts } from '@quran-review/shared';
import * as attendanceService from '../../services/attendance.service';
import { AppError } from '../../middleware/error.middleware';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const listAttendance = defineRoute(schedulingContracts.listAttendance, async ({ query, userId, userRole }) => {
  const callerRole = userRole as 'STUDENT' | 'TEACHER' | 'ADMIN';
  const studentId =
    (typeof query.studentId === 'string' && query.studentId) || (callerRole === 'STUDENT' ? userId! : null);
  if (!studentId) {
    throw new AppError(400, 'studentId is required (or call without it as a student to fetch your own)');
  }
  const records = await attendanceService.getStudentAttendance(userId!, callerRole, studentId);
  return { status: 200 as const, body: { success: true as const, data: records } };
});

export const attendanceRouter = buildContractRouter([listAttendance], { mountPrefix: '/api/v1/attendance' });
