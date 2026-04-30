import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import express from 'express';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from '../../prisma/client';
import { createAppointment, getMyAppointments, manageAppointment } from '../appointment.controller';

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;

function createTestApp(userId: string, userRole: string) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.userId = userId;
    req.userRole = userRole;
    next();
  });
  app.post('/', createAppointment);
  app.get('/', getMyAppointments);
  app.put('/:id', manageAppointment);
  return app;
}

describe('appointment.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /', () => {
    it('should create appointment for student', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ id: 'teacher-1', role: 'TEACHER' } as any);
      mockedPrisma.appointment.findMany.mockResolvedValue([]);
      mockedPrisma.appointment.create.mockResolvedValue({ id: 'appt-1' } as any);

      const app = createTestApp('student-1', 'student');
      const res = await request(app)
        .post('/')
        .send({ teacherId: 'teacher-1', requestedDate: '2025-06-01', requestedTime: '10:00', durationMinutes: 60 });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('appt-1');
    });

    it('should reject missing fields', async () => {
      const app = createTestApp('student-1', 'student');
      const res = await request(app)
        .post('/')
        .send({ teacherId: 'teacher-1' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /', () => {
    it('should return appointments for student', async () => {
      mockedPrisma.appointment.findMany.mockResolvedValue([{ id: 'appt-1' }] as any);

      const app = createTestApp('student-1', 'student');
      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });

  describe('PUT /:id', () => {
    it('should allow teacher to accept own appointment', async () => {
      mockedPrisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-1',
        teacherId: 'teacher-1',
        studentId: 'student-1',
      } as any);
      mockedPrisma.appointment.update.mockResolvedValue({ id: 'appt-1', status: 'ACCEPTED' } as any);

      const app = createTestApp('teacher-1', 'teacher');
      const res = await request(app)
        .put('/appt-1')
        .send({ action: 'ACCEPTED' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ACCEPTED');
    });

    it('should reject teacher managing another appointment', async () => {
      mockedPrisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-1',
        teacherId: 'teacher-2',
      } as any);

      const app = createTestApp('teacher-1', 'teacher');
      const res = await request(app)
        .put('/appt-1')
        .send({ action: 'ACCEPTED' });

      expect(res.status).toBe(403);
    });
  });
});
