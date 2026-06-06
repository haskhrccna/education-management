import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/error.middleware';
import * as attendanceService from '../services/attendance.service';
import type { AttendanceStatusInput } from '../services/attendance.service';

const ALLOWED: AttendanceStatusInput[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];

export const recordAttendance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const teacherId = req.userId;
    if (!teacherId) throw new AppError(401, 'Authentication required');

    const appointmentId = String(req.params.id);
    const { status, notes } = req.body ?? {};
    if (!status || !ALLOWED.includes(status)) {
      throw new AppError(400, `status must be one of ${ALLOWED.join(', ')}`);
    }

    const record = await attendanceService.recordAttendance(
      appointmentId,
      teacherId,
      status,
      typeof notes === 'string' && notes.length > 0 ? notes : undefined
    );
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
};

export const listAttendance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const callerId = req.userId;
    const callerRole = req.userRole as 'STUDENT' | 'TEACHER' | 'ADMIN' | undefined;
    if (!callerId || !callerRole) throw new AppError(401, 'Authentication required');

    const studentId =
      (typeof req.query.studentId === 'string' && req.query.studentId) ||
      (callerRole === 'STUDENT' ? callerId : null);
    if (!studentId) {
      throw new AppError(400, 'studentId is required (or call without it as a student to fetch your own)');
    }

    const records = await attendanceService.getStudentAttendance(callerId, callerRole, studentId);
    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
};
