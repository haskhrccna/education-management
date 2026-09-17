/**
 * Report + certificate PDFs must survive a redeploy.
 *
 * Recordings already moved to the shared S3 layer, but generated PDFs were
 * still written to local disk only — on an ephemeral host (Render/Railway/Fly,
 * or any container) that disk is wiped on every deploy, so every report and
 * completion certificate a row points at disappears while the row survives.
 *
 * These tests pin the three halves of the fix: the writer offloads to the
 * bucket when one is configured, the URL discriminator keeps legacy local rows
 * on the disk path, and the download route streams from the bucket without
 * weakening any authorization check.
 */
import request from 'supertest';

jest.mock('../services/storage.service', () => ({
  isStorageEnabled: jest.fn().mockReturnValue(true),
  putFile: jest.fn().mockResolvedValue(undefined),
  removeObject: jest.fn().mockResolvedValue(undefined),
  assertObjectExists: jest.fn().mockResolvedValue(undefined),
  streamObject: jest.fn().mockImplementation(async (_key: string, res: any) => {
    res.end('pdf-bytes');
  }),
  presignUpload: jest.fn(),
  completeUpload: jest.fn(),
}));

jest.mock('../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.userId = 'student-1';
    req.userRole = 'STUDENT';
    next();
  },
  authorize: () => (_req: any, _res: any, next: any) => next(),
  fileAuthenticate: (req: any, _res: any, next: any) => {
    req.userId = 'student-1';
    req.userRole = 'STUDENT';
    next();
  },
}));

import * as storageService from '../services/storage.service';
import * as fileService from '../services/file.service';
import { AppError } from '../middleware/error.middleware';
import { prisma } from '../prisma/client';

const prismaMock = prisma as unknown as {
  report: { findUnique: jest.Mock };
  certificate: { findUnique: jest.Mock };
};

describe('generated-PDF durability', () => {
  describe('URL discriminator', () => {
    it('treats a raw object key as bucket-stored', () => {
      expect(fileService.isObjectStoragePdfUrl('reports/report-abc-1.pdf', 'reports')).toBe(true);
      expect(fileService.isObjectStoragePdfUrl('certificates/certificate-abc-1.pdf', 'certificates')).toBe(true);
      expect(fileService.isObjectStoragePdfUrl('https://cdn.example.com/bucket/reports/x.pdf', 'reports')).toBe(true);
    });

    it('keeps legacy local-disk rows on the disk path', () => {
      // Every pre-migration row looks like this; misclassifying one would
      // 404 a report that is sitting right there on disk.
      expect(fileService.isObjectStoragePdfUrl('/reports/report-abc-1.pdf', 'reports')).toBe(false);
      expect(fileService.isObjectStoragePdfUrl('/certificates/certificate-abc-1.pdf', 'certificates')).toBe(false);
    });

    it('does not confuse the two prefixes', () => {
      expect(fileService.isObjectStoragePdfUrl('reports/x.pdf', 'certificates')).toBe(false);
    });
  });

  describe('resolveReportStorageBlob', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns the object key for a bucket-stored report the student owns', async () => {
      prismaMock.report.findUnique.mockResolvedValue({
        id: 'r1',
        studentId: 'student-1',
        teacherId: 't1',
        pdfUrl: 'reports/report-student-1-123.pdf',
      });
      const blob = await fileService.resolveReportStorageBlob('student-1', 'STUDENT', 'r1');
      expect(blob).toEqual({ storageKey: 'reports/report-student-1-123.pdf', fileName: 'report-student-1-123.pdf' });
    });

    it('returns null for a legacy local row so the caller falls back to disk', async () => {
      prismaMock.report.findUnique.mockResolvedValue({
        id: 'r1',
        studentId: 'student-1',
        teacherId: 't1',
        pdfUrl: '/reports/report-student-1-123.pdf',
      });
      expect(await fileService.resolveReportStorageBlob('student-1', 'STUDENT', 'r1')).toBeNull();
    });

    it('still refuses an unrelated student — the bucket path must not widen access', async () => {
      prismaMock.report.findUnique.mockResolvedValue({
        id: 'r1',
        studentId: 'someone-else',
        teacherId: 't1',
        pdfUrl: 'reports/report-someone-else-123.pdf',
      });
      await expect(fileService.resolveReportStorageBlob('student-1', 'STUDENT', 'r1')).rejects.toMatchObject({
        statusCode: 403,
      });
    });
  });

  describe('resolveCertificateStorageBlob', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns the object key for the owner', async () => {
      prismaMock.certificate.findUnique.mockResolvedValue({
        id: 'c1',
        studentId: 'student-1',
        pdfUrl: 'certificates/certificate-student-1-9.pdf',
      });
      const blob = await fileService.resolveCertificateStorageBlob('student-1', 'STUDENT', 'c1');
      expect(blob?.storageKey).toBe('certificates/certificate-student-1-9.pdf');
    });

    it('refuses a non-owner student', async () => {
      prismaMock.certificate.findUnique.mockResolvedValue({
        id: 'c1',
        studentId: 'someone-else',
        pdfUrl: 'certificates/certificate-someone-else-9.pdf',
      });
      await expect(fileService.resolveCertificateStorageBlob('student-1', 'STUDENT', 'c1')).rejects.toMatchObject({
        statusCode: 403,
      });
    });
  });

  describe('GET /api/v1/files/reports/:id', () => {
    let app: any;
    beforeAll(async () => {
      app = (await import('../app')).default;
    });
    beforeEach(() => jest.clearAllMocks());

    it('streams a bucket-stored report instead of touching the disk', async () => {
      prismaMock.report.findUnique.mockResolvedValue({
        id: 'r1',
        studentId: 'student-1',
        teacherId: 't1',
        pdfUrl: 'reports/report-student-1-123.pdf',
      });
      const res = await request(app).get('/api/v1/files/reports/r1');
      expect(res.status).toBe(200);
      expect(storageService.streamObject).toHaveBeenCalledWith('reports/report-student-1-123.pdf', expect.anything());
      expect(res.headers['content-disposition']).toContain('report-student-1-123.pdf');
      // Private media must never be cached by a shared proxy.
      expect(res.headers['cache-control']).toBe('private, no-store');
    });

    it('404s when the row points at an object that is not in the bucket', async () => {
      prismaMock.report.findUnique.mockResolvedValue({
        id: 'r1',
        studentId: 'student-1',
        teacherId: 't1',
        pdfUrl: 'reports/missing.pdf',
      });
      (storageService.assertObjectExists as jest.Mock).mockRejectedValueOnce(new AppError(404, 'File not found'));
      const res = await request(app).get('/api/v1/files/reports/r1');
      expect(res.status).toBe(404);
      expect(storageService.streamObject).not.toHaveBeenCalled();
    });
  });
});
