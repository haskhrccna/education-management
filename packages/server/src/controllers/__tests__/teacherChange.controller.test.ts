import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import express from 'express';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

jest.mock('../../services/teacherChange.service', () => ({
  submitTeacherChangeRequest: jest.fn(),
  getTeacherChangeRequests: jest.fn(),
  decideTeacherChangeRequest: jest.fn(),
}));

import * as teacherChangeService from '../../services/teacherChange.service';
import { submitRequest, getRequests, decideRequest } from '../teacherChange.controller';

const mockedService = teacherChangeService as jest.Mocked<typeof teacherChangeService>;

function createApp(userId = 'student-1', userRole = 'STUDENT') {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.userId = userId;
    req.userRole = userRole;
    next();
  });
  app.post('/teacher-change', submitRequest);
  app.get('/teacher-change', getRequests);
  app.patch('/teacher-change/:id', decideRequest);
  app.use((err: any, _req: any, res: any, _next: any) =>
    res.status(err.statusCode || 500).json({ error: err.message })
  );
  return app;
}

describe('teacherChange.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /teacher-change', () => {
    it('submits a teacher change request', async () => {
      mockedService.submitTeacherChangeRequest.mockResolvedValue({ id: 'req-1', status: 'PENDING' } as any);

      const res = await request(createApp()).post('/teacher-change').send({ reason: 'Need a different schedule' });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('req-1');
      expect(mockedService.submitTeacherChangeRequest).toHaveBeenCalledWith('student-1', 'Need a different schedule');
    });

    it('propagates 409 when a pending request already exists', async () => {
      const appError = Object.assign(new Error('already have a pending request'), { statusCode: 409 });
      mockedService.submitTeacherChangeRequest.mockRejectedValue(appError);

      const res = await request(createApp()).post('/teacher-change').send({ reason: 'test' });
      expect(res.status).toBe(409);
    });
  });

  describe('GET /teacher-change', () => {
    it('returns requests for STUDENT role without status filter', async () => {
      mockedService.getTeacherChangeRequests.mockResolvedValue([{ id: 'req-1' }] as any);

      const res = await request(createApp()).get('/teacher-change');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(mockedService.getTeacherChangeRequests).toHaveBeenCalledWith('student-1', 'STUDENT', undefined);
    });

    it('passes status filter query param to service', async () => {
      mockedService.getTeacherChangeRequests.mockResolvedValue([] as any);

      await request(createApp('admin-1', 'ADMIN')).get('/teacher-change?status=PENDING');

      expect(mockedService.getTeacherChangeRequests).toHaveBeenCalledWith('admin-1', 'ADMIN', 'PENDING');
    });
  });

  describe('PATCH /teacher-change/:id', () => {
    it('approves a request and assigns a new teacher', async () => {
      mockedService.decideTeacherChangeRequest.mockResolvedValue({ id: 'req-1', status: 'APPROVED' } as any);

      const res = await request(createApp('admin-1', 'ADMIN'))
        .patch('/teacher-change/req-1')
        .send({ action: 'APPROVE', newTeacherId: 'teacher-2', adminNote: 'Approved' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('APPROVED');
      expect(mockedService.decideTeacherChangeRequest).toHaveBeenCalledWith(
        'req-1',
        'APPROVE',
        'admin-1',
        'ADMIN',
        'Approved',
        'teacher-2'
      );
    });

    it('denies a request with an admin note', async () => {
      mockedService.decideTeacherChangeRequest.mockResolvedValue({ id: 'req-1', status: 'DENIED' } as any);

      const res = await request(createApp('admin-1', 'ADMIN'))
        .patch('/teacher-change/req-1')
        .send({ action: 'DENY', adminNote: 'Not valid' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('DENIED');
    });

    it('propagates 403 when non-admin calls decideRequest', async () => {
      const appError = Object.assign(new Error('Only admins can decide teacher change requests'), { statusCode: 403 });
      mockedService.decideTeacherChangeRequest.mockRejectedValue(appError);

      const res = await request(createApp('teacher-1', 'TEACHER'))
        .patch('/teacher-change/req-1')
        .send({ action: 'APPROVE' });

      expect(res.status).toBe(403);
    });
  });
});
