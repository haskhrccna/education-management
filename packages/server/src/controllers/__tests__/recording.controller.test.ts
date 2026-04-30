import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import express from 'express';
import fs from 'fs/promises';

jest.mock('fs/promises');

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from '../../prisma/client';
import { uploadRecording, listRecordings, reviewRecording, deleteRecording } from '../recording.controller';

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;
const mockedFs = fs as jest.Mocked<typeof fs>;

function createTestApp(userId: string, userRole: string) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.userId = userId;
    req.userRole = userRole;
    next();
  });
  app.post('/', uploadRecording);
  app.get('/', listRecordings);
  app.put('/:id', reviewRecording);
  app.delete('/:id', deleteRecording);
  return app;
}

describe('recording.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /', () => {
    it('should upload recording metadata', async () => {
      mockedFs.access.mockRejectedValue(new Error('no dir'));
      mockedFs.mkdir.mockResolvedValue(undefined as any);
      mockedFs.copyFile.mockResolvedValue(undefined as any);
      mockedFs.unlink.mockResolvedValue(undefined as any);
      mockedPrisma.recording.create.mockResolvedValue({ id: 'rec-1' } as any);

      const app = createTestApp('student-1', 'student');
      const res = await request(app)
        .post('/')
        .send({ fileName: 'test.mp3', fileSizeBytes: 1024, contentType: 'audio/mpeg' });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('rec-1');
    });

    it('should reject missing fileName', async () => {
      const app = createTestApp('student-1', 'student');
      const res = await request(app).post('/').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('GET /', () => {
    it('should list recordings', async () => {
      mockedPrisma.recording.findMany.mockResolvedValue([{ id: 'rec-1' }] as any);

      const app = createTestApp('student-1', 'student');
      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });

  describe('PUT /:id', () => {
    it('should review recording', async () => {
      mockedPrisma.recording.findUnique.mockResolvedValue({ id: 'rec-1' } as any);
      mockedPrisma.recording.update.mockResolvedValue({ id: 'rec-1', approvedAt: new Date() } as any);

      const app = createTestApp('teacher-1', 'teacher');
      const res = await request(app)
        .put('/rec-1')
        .send({ approved: true, notes: 'Good' });

      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /:id', () => {
    it('should allow teacher to delete any recording', async () => {
      mockedPrisma.recording.findUnique.mockResolvedValue({
        id: 'rec-1',
        studentId: 'student-1',
        url: '/uploads/file.mp3',
      } as any);
      mockedFs.unlink.mockResolvedValue(undefined as any);
      mockedPrisma.recording.delete.mockResolvedValue({ id: 'rec-1' } as any);

      const app = createTestApp('teacher-1', 'teacher');
      const res = await request(app).delete('/rec-1');

      expect(res.status).toBe(200);
    });

    it('should allow student to delete own recording', async () => {
      mockedPrisma.recording.findUnique.mockResolvedValue({
        id: 'rec-1',
        studentId: 'student-1',
        url: '/uploads/file.mp3',
      } as any);
      mockedFs.unlink.mockResolvedValue(undefined as any);
      mockedPrisma.recording.delete.mockResolvedValue({ id: 'rec-1' } as any);

      const app = createTestApp('student-1', 'student');
      const res = await request(app).delete('/rec-1');

      expect(res.status).toBe(200);
    });

    it('should reject student deleting another recording', async () => {
      mockedPrisma.recording.findUnique.mockResolvedValue({
        id: 'rec-1',
        studentId: 'student-2',
      } as any);

      const app = createTestApp('student-1', 'student');
      const res = await request(app).delete('/rec-1');

      expect(res.status).toBe(403);
    });
  });
});
