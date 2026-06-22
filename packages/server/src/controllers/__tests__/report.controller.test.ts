import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import express from 'express';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

jest.mock('../../services/report.service', () => ({
  generatePDFReport: jest.fn(),
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    ...jest.requireActual('fs').promises,
    unlink: jest.fn().mockResolvedValue(undefined),
  },
}));

import { prisma } from '../../prisma/client';
import * as reportService from '../../services/report.service';
import { generateReport, getMyReports } from '../report.controller';

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;
const mockedReportService = reportService as jest.Mocked<typeof reportService>;

function createApp(userId = 'teacher-1', userRole = 'TEACHER') {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.userId = userId;
    req.userRole = userRole;
    next();
  });
  app.post('/reports', generateReport);
  app.get('/reports', getMyReports);
  app.use((err: any, _req: any, res: any, _next: any) =>
    res.status(err.statusCode || 500).json({ error: err.message })
  );
  return app;
}

describe('report.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /reports', () => {
    it('generates and persists a PDF report', async () => {
      mockedPrisma.appointment.findFirst.mockResolvedValue({ id: 'appt-1' } as any);
      mockedReportService.generatePDFReport.mockResolvedValue('/reports/report-student-1-123.pdf');
      mockedPrisma.report.create.mockResolvedValue({
        id: 'report-1',
        pdfUrl: '/reports/report-student-1-123.pdf',
      } as any);

      const res = await request(createApp())
        .post('/reports')
        .send({ studentId: 'student-1', summary: 'Good progress' });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('report-1');
      expect(mockedReportService.generatePDFReport).toHaveBeenCalledWith('teacher-1', 'student-1', 'Good progress');
    });

    it('returns 400 when studentId is missing', async () => {
      const res = await request(createApp()).post('/reports').send({ summary: 'test' });
      expect(res.status).toBe(400);
    });

    it('returns 403 when teacher has no accepted appointment with student', async () => {
      mockedPrisma.appointment.findFirst.mockResolvedValue(null);

      const res = await request(createApp()).post('/reports').send({ studentId: 'student-1' });
      expect(res.status).toBe(403);
    });

    it('deletes orphaned PDF and re-throws when DB insert fails', async () => {
      mockedPrisma.appointment.findFirst.mockResolvedValue({ id: 'appt-1' } as any);
      mockedReportService.generatePDFReport.mockResolvedValue('/reports/report-s1-123.pdf');
      mockedPrisma.report.create.mockRejectedValue(new Error('DB error'));

      const fs = require('fs');
      const res = await request(createApp()).post('/reports').send({ studentId: 'student-1' });

      expect(res.status).toBe(500);
      expect(fs.promises.unlink).toHaveBeenCalled();
    });

    it('uses empty string summary when summary not provided', async () => {
      mockedPrisma.appointment.findFirst.mockResolvedValue({ id: 'appt-1' } as any);
      mockedReportService.generatePDFReport.mockResolvedValue('/reports/report.pdf');
      mockedPrisma.report.create.mockResolvedValue({ id: 'report-1' } as any);

      await request(createApp()).post('/reports').send({ studentId: 'student-1' });

      expect(mockedReportService.generatePDFReport).toHaveBeenCalledWith('teacher-1', 'student-1', '');
    });
  });

  describe('GET /reports', () => {
    it('filters by studentId for STUDENT role', async () => {
      mockedPrisma.report.findMany.mockResolvedValue([{ id: 'report-1' }] as any);

      const res = await request(createApp('student-1', 'STUDENT')).get('/reports');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(mockedPrisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { studentId: 'student-1' } })
      );
    });

    it('filters by teacherId for TEACHER role', async () => {
      mockedPrisma.report.findMany.mockResolvedValue([{ id: 'report-1' }] as any);

      const res = await request(createApp('teacher-1', 'TEACHER')).get('/reports');

      expect(res.status).toBe(200);
      expect(mockedPrisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { teacherId: 'teacher-1' } })
      );
    });
  });
});
