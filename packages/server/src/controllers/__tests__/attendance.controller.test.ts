import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import express from 'express';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

jest.mock('../../services/attendance.service', () => ({
  recordAttendance: jest.fn(),
  getStudentAttendance: jest.fn(),
}));

import * as attendanceService from '../../services/attendance.service';
import { recordAttendance, listAttendance } from '../attendance.controller';

const mockedService = attendanceService as jest.Mocked<typeof attendanceService>;

function createApp(userId: string | null = 'teacher-1', userRole: string | null = 'TEACHER') {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    if (userId !== null) req.userId = userId;
    if (userRole !== null) req.userRole = userRole;
    next();
  });
  app.post('/appointments/:id/attendance', recordAttendance);
  app.get('/attendance', listAttendance);
  app.use((err: any, _req: any, res: any, _next: any) =>
    res.status(err.statusCode || 500).json({ error: err.message })
  );
  return app;
}

describe('attendance.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /appointments/:id/attendance', () => {
    it('records attendance with a valid status', async () => {
      mockedService.recordAttendance.mockResolvedValue({ id: 'sr-1', status: 'PRESENT' } as any);

      const res = await request(createApp())
        .post('/appointments/appt-1/attendance')
        .send({ status: 'PRESENT', notes: 'On time' });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('PRESENT');
      expect(mockedService.recordAttendance).toHaveBeenCalledWith('appt-1', 'teacher-1', 'PRESENT', 'On time');
    });

    it('passes undefined notes when notes are an empty string', async () => {
      mockedService.recordAttendance.mockResolvedValue({ id: 'sr-1' } as any);

      await request(createApp()).post('/appointments/appt-1/attendance').send({ status: 'LATE', notes: '' });

      expect(mockedService.recordAttendance).toHaveBeenCalledWith('appt-1', 'teacher-1', 'LATE', undefined);
    });

    it('returns 400 for an invalid status value', async () => {
      const res = await request(createApp()).post('/appointments/appt-1/attendance').send({ status: 'MAYBE' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when status is missing', async () => {
      const res = await request(createApp()).post('/appointments/appt-1/attendance').send({});
      expect(res.status).toBe(400);
    });

    it('returns 401 when caller is unauthenticated', async () => {
      const res = await request(createApp(null, null))
        .post('/appointments/appt-1/attendance')
        .send({ status: 'PRESENT' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /attendance', () => {
    it('returns a student their own attendance when no studentId is given', async () => {
      mockedService.getStudentAttendance.mockResolvedValue([{ id: 'sr-1' }] as any);

      const res = await request(createApp('student-1', 'STUDENT')).get('/attendance');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(mockedService.getStudentAttendance).toHaveBeenCalledWith('student-1', 'STUDENT', 'student-1');
    });

    it('lets a teacher query a specific studentId', async () => {
      mockedService.getStudentAttendance.mockResolvedValue([{ id: 'sr-1' }] as any);

      await request(createApp('teacher-1', 'TEACHER')).get('/attendance?studentId=student-9');

      expect(mockedService.getStudentAttendance).toHaveBeenCalledWith('teacher-1', 'TEACHER', 'student-9');
    });

    it('returns 400 when a teacher omits studentId', async () => {
      const res = await request(createApp('teacher-1', 'TEACHER')).get('/attendance');
      expect(res.status).toBe(400);
    });

    it('returns 401 when caller is unauthenticated', async () => {
      const res = await request(createApp(null, null)).get('/attendance');
      expect(res.status).toBe(401);
    });
  });
});
