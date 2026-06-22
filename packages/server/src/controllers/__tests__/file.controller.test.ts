import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import express from 'express';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

jest.mock('../../lib/storage', () => ({
  uploadStorage: {
    exists: jest.fn(),
    getLocalPath: jest.fn().mockReturnValue('/tmp/test-file.webm'),
  },
  reportStorage: {
    exists: jest.fn(),
    getLocalPath: jest.fn().mockReturnValue('/tmp/test-report.pdf'),
  },
}));

import { prisma } from '../../prisma/client';
import * as storage from '../../lib/storage';
import { downloadRecording, downloadReport } from '../file.controller';

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;
const mockedUploadStorage = storage.uploadStorage as jest.Mocked<typeof storage.uploadStorage>;
const mockedReportStorage = storage.reportStorage as jest.Mocked<typeof storage.reportStorage>;

function createApp(userId = 'student-1', userRole = 'STUDENT') {
  const app = express();
  // Stub sendFile before routes so it doesn't hit the real filesystem
  app.use((_req: any, res: any, next: any) => {
    res.sendFile = jest.fn((_p: string) => res.status(200).json({ downloaded: true }));
    next();
  });
  app.use((req: any, _res: any, next: any) => {
    req.userId = userId;
    req.userRole = userRole;
    next();
  });
  app.get('/recordings/:id', downloadRecording);
  app.get('/reports/:id', downloadReport);
  app.use((err: any, _req: any, res: any, _next: any) =>
    res.status(err.statusCode || 500).json({ error: err.message })
  );
  return app;
}

describe('file.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /recordings/:id', () => {
    it('allows student owner to download their recording', async () => {
      mockedPrisma.recording.findUnique.mockResolvedValue({
        id: 'rec-1',
        studentId: 'student-1',
        url: '/uploads/audio.webm',
      } as any);
      mockedUploadStorage.exists.mockResolvedValue(true);

      const res = await request(createApp()).get('/recordings/rec-1');
      expect(res.status).toBe(200);
    });

    it('returns 404 when recording record does not exist', async () => {
      mockedPrisma.recording.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).get('/recordings/missing');
      expect(res.status).toBe(404);
    });

    it('returns 403 when caller is not owner, admin, or teacher', async () => {
      mockedPrisma.recording.findUnique.mockResolvedValue({
        id: 'rec-1',
        studentId: 'other-student',
        url: '/uploads/audio.webm',
      } as any);

      const res = await request(createApp('student-2', 'STUDENT')).get('/recordings/rec-1');
      expect(res.status).toBe(403);
    });

    it('allows admin to download any student recording', async () => {
      mockedPrisma.recording.findUnique.mockResolvedValue({
        id: 'rec-1',
        studentId: 'student-1',
        url: '/uploads/audio.webm',
      } as any);
      mockedUploadStorage.exists.mockResolvedValue(true);

      const res = await request(createApp('admin-1', 'ADMIN')).get('/recordings/rec-1');
      expect(res.status).toBe(200);
    });

    it('allows teacher with accepted appointment to download', async () => {
      mockedPrisma.recording.findUnique.mockResolvedValue({
        id: 'rec-1',
        studentId: 'student-1',
        url: '/uploads/audio.webm',
      } as any);
      mockedPrisma.appointment.findFirst.mockResolvedValue({ id: 'appt-1' } as any);
      mockedUploadStorage.exists.mockResolvedValue(true);

      const res = await request(createApp('teacher-1', 'TEACHER')).get('/recordings/rec-1');
      expect(res.status).toBe(200);
    });

    it('returns 403 when teacher has no accepted appointment', async () => {
      mockedPrisma.recording.findUnique.mockResolvedValue({
        id: 'rec-1',
        studentId: 'student-1',
        url: '/uploads/audio.webm',
      } as any);
      mockedPrisma.appointment.findFirst.mockResolvedValue(null);

      const res = await request(createApp('teacher-1', 'TEACHER')).get('/recordings/rec-1');
      expect(res.status).toBe(403);
    });

    it('returns 404 when file does not exist on disk', async () => {
      mockedPrisma.recording.findUnique.mockResolvedValue({
        id: 'rec-1',
        studentId: 'student-1',
        url: '/uploads/audio.webm',
      } as any);
      mockedUploadStorage.exists.mockResolvedValue(false);

      const res = await request(createApp()).get('/recordings/rec-1');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /reports/:id', () => {
    it('allows student owner to download their report', async () => {
      mockedPrisma.report.findUnique.mockResolvedValue({
        id: 'report-1',
        studentId: 'student-1',
        pdfUrl: '/reports/report.pdf',
      } as any);
      mockedReportStorage.exists.mockResolvedValue(true);

      const res = await request(createApp()).get('/reports/report-1');
      expect(res.status).toBe(200);
    });

    it('returns 404 when report record does not exist', async () => {
      mockedPrisma.report.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).get('/reports/missing');
      expect(res.status).toBe(404);
    });

    it('returns 403 for non-owner non-admin non-teacher', async () => {
      mockedPrisma.report.findUnique.mockResolvedValue({
        id: 'report-1',
        studentId: 'other-student',
        pdfUrl: '/reports/report.pdf',
      } as any);

      const res = await request(createApp('student-2', 'STUDENT')).get('/reports/report-1');
      expect(res.status).toBe(403);
    });

    it('allows teacher with appointment to download report', async () => {
      mockedPrisma.report.findUnique.mockResolvedValue({
        id: 'report-1',
        studentId: 'student-1',
        pdfUrl: '/reports/report.pdf',
      } as any);
      mockedPrisma.appointment.findFirst.mockResolvedValue({ id: 'appt-1' } as any);
      mockedReportStorage.exists.mockResolvedValue(true);

      const res = await request(createApp('teacher-1', 'TEACHER')).get('/reports/report-1');
      expect(res.status).toBe(200);
    });

    it('returns 404 when PDF file is missing from disk', async () => {
      mockedPrisma.report.findUnique.mockResolvedValue({
        id: 'report-1',
        studentId: 'student-1',
        pdfUrl: '/reports/report.pdf',
      } as any);
      mockedReportStorage.exists.mockResolvedValue(false);

      const res = await request(createApp()).get('/reports/report-1');
      expect(res.status).toBe(404);
    });
  });
});
