import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import express from 'express';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

jest.mock('../../services/revision.service', () => ({
  getRevisions: jest.fn(),
  createRevision: jest.fn(),
  updateRevision: jest.fn(),
  deleteRevision: jest.fn(),
}));

import * as revisionService from '../../services/revision.service';
import { getMyRevisions, createRevision, markRevision, deleteRevision } from '../revision.controller';

const mockedService = revisionService as jest.Mocked<typeof revisionService>;

function createApp(userId = 'teacher-1', userRole = 'TEACHER') {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.userId = userId;
    req.userRole = userRole;
    next();
  });
  app.get('/revisions', getMyRevisions);
  app.post('/revisions', createRevision);
  app.patch('/revisions/:id', markRevision);
  app.delete('/revisions/:id', deleteRevision);
  app.use((err: any, _req: any, res: any, _next: any) =>
    res.status(err.statusCode || 500).json({ error: err.message })
  );
  return app;
}

describe('revision.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /revisions', () => {
    it('returns all revisions for the caller', async () => {
      mockedService.getRevisions.mockResolvedValue([{ id: 'rev-1' }] as any);

      const res = await request(createApp()).get('/revisions');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(mockedService.getRevisions).toHaveBeenCalledWith('teacher-1', 'TEACHER', undefined);
    });

    it('passes surahId filter when provided as query param', async () => {
      mockedService.getRevisions.mockResolvedValue([] as any);

      await request(createApp()).get('/revisions?surahId=5');

      expect(mockedService.getRevisions).toHaveBeenCalledWith('teacher-1', 'TEACHER', 5);
    });

    it('returns 400 for a non-numeric surahId', async () => {
      const res = await request(createApp()).get('/revisions?surahId=abc');
      expect(res.status).toBe(400);
    });
  });

  describe('POST /revisions', () => {
    it('creates a revision schedule entry', async () => {
      mockedService.createRevision.mockResolvedValue({ id: 'rev-1', status: 'PENDING' } as any);

      const res = await request(createApp()).post('/revisions').send({
        studentId: 'student-1',
        surahId: 2,
        scheduledFor: '2026-07-01',
      });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('rev-1');
      expect(mockedService.createRevision).toHaveBeenCalledWith('teacher-1', 'student-1', 2, expect.any(Date));
    });

    it('returns 500 when studentId is missing', async () => {
      const res = await request(createApp()).post('/revisions').send({ surahId: 2, scheduledFor: '2026-07-01' });
      expect(res.status).toBe(500);
    });

    it('returns 500 when surahId is not a number', async () => {
      const res = await request(createApp())
        .post('/revisions')
        .send({ studentId: 's-1', surahId: 'bad', scheduledFor: '2026-07-01' });
      expect(res.status).toBe(500);
    });
  });

  describe('PATCH /revisions/:id', () => {
    it('marks a revision as COMPLETED', async () => {
      mockedService.updateRevision.mockResolvedValue({ id: 'rev-1', status: 'COMPLETED' } as any);

      const res = await request(createApp('student-1', 'STUDENT'))
        .patch('/revisions/rev-1')
        .send({ status: 'COMPLETED' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('COMPLETED');
      expect(mockedService.updateRevision).toHaveBeenCalledWith('rev-1', 'student-1', 'STUDENT', 'COMPLETED');
    });

    it('returns 500 when status is missing from body', async () => {
      const res = await request(createApp()).patch('/revisions/rev-1').send({});
      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /revisions/:id', () => {
    it('deletes a revision by id', async () => {
      mockedService.deleteRevision.mockResolvedValue({ message: 'Deleted' } as any);

      const res = await request(createApp()).delete('/revisions/rev-1');

      expect(res.status).toBe(200);
      expect(mockedService.deleteRevision).toHaveBeenCalledWith('rev-1', 'teacher-1', 'TEACHER');
    });
  });
});
