import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    createWriteStream: jest.fn(),
    promises: {
      access: jest.fn(),
      mkdir: jest.fn(),
      unlink: jest.fn().mockResolvedValue(undefined),
    },
  };
});

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

// Object storage is OFF by default here, so the existing local-disk
// expectations below are unaffected; the durability tests turn it on.
jest.mock('../storage.service', () => ({
  isStorageEnabled: jest.fn().mockReturnValue(false),
  putFile: jest.fn().mockResolvedValue(undefined),
  removeObject: jest.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../../prisma/client';
import * as storageService from '../storage.service';
import { generatePDFReport, createReport, listMyReports } from '../report.service';

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('report.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.$transaction.mockImplementation(async (fn: any) => {
      return fn(mockedPrisma);
    });
  });

  describe('generatePDFReport', () => {
    it('should generate PDF for existing student with grades', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({
        firstName: 'Ali',
        lastName: 'Ahmad',
        email: 'ali@test.com',
      } as any);
      mockedPrisma.grade.findMany.mockResolvedValue([
        {
          grade: '95',
          type: 'EXAM',
          notes: 'Great',
          createdAt: new Date(),
          surah: { nameAr: 'الفاتحة', nameEn: 'Al-Fatiha' },
        },
      ] as any);
      mockedPrisma.recording.count.mockResolvedValue(3);

      mockedFs.createWriteStream.mockReturnValue({
        on: jest.fn((event, cb) => {
          if (event === 'finish') setTimeout(cb, 0);
          return { on: jest.fn() } as any;
        }),
        write: jest.fn(),
        end: jest.fn(),
        destroy: jest.fn(),
        once: jest.fn(),
        emit: jest.fn(),
        pipe: jest.fn(),
      } as any);

      const result = await generatePDFReport('teacher-1', 'student-1', 'Good progress');
      expect(result).toContain('/reports/');
      expect(result).toContain('student-1');
    });

    it('should reject non-existent student', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);
      mockedPrisma.grade.findMany.mockResolvedValue([]);
      mockedPrisma.recording.count.mockResolvedValue(0);

      await expect(generatePDFReport('teacher-1', 'unknown', '')).rejects.toThrow('Student not found');
    });

    it('should handle student with no grades', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({
        firstName: 'Ali',
        lastName: 'Ahmad',
        email: 'ali@test.com',
      } as any);
      mockedPrisma.grade.findMany.mockResolvedValue([]);
      mockedPrisma.recording.count.mockResolvedValue(0);

      mockedFs.createWriteStream.mockReturnValue({
        on: jest.fn((event, cb) => {
          if (event === 'finish') setTimeout(cb, 0);
          return { on: jest.fn() } as any;
        }),
        write: jest.fn(),
        end: jest.fn(),
        destroy: jest.fn(),
        once: jest.fn(),
        emit: jest.fn(),
        pipe: jest.fn(),
      } as any);

      const result = await generatePDFReport('teacher-1', 'student-1', '');
      expect(result).toContain('/reports/');
    });
  });

  describe('createReport (moved from report.controller)', () => {
    function stubWriteStream() {
      mockedFs.createWriteStream.mockReturnValue({
        on: jest.fn((event, cb) => {
          if (event === 'finish') setTimeout(cb, 0);
          return { on: jest.fn() } as any;
        }),
        write: jest.fn(),
        end: jest.fn(),
        destroy: jest.fn(),
        once: jest.fn(),
        emit: jest.fn(),
        pipe: jest.fn(),
      } as any);
    }

    it('throws 403 without an accepted appointment', async () => {
      mockedPrisma.appointment.findFirst.mockResolvedValue(null);
      await expect(createReport('teacher-1', 'student-1', 's')).rejects.toThrow(
        'No accepted appointment with this student'
      );
    });

    it('deletes the orphaned PDF and re-throws when the DB insert fails', async () => {
      mockedPrisma.appointment.findFirst.mockResolvedValue({ id: 'appt-1' } as any);
      mockedPrisma.user.findUnique.mockResolvedValue({ firstName: 'A', lastName: 'B', email: 'a@b.c' } as any);
      mockedPrisma.grade.findMany.mockResolvedValue([]);
      mockedPrisma.recording.count.mockResolvedValue(0);
      stubWriteStream();
      mockedPrisma.report.create.mockRejectedValue(new Error('DB error'));

      await expect(createReport('teacher-1', 'student-1', 's')).rejects.toThrow('DB error');
      expect(mockedFs.promises.unlink).toHaveBeenCalled();
    });
  });

  describe('listMyReports', () => {
    it('filters by studentId for STUDENT and teacherId otherwise', async () => {
      mockedPrisma.report.findMany.mockResolvedValue([]);
      await listMyReports('u-1', 'STUDENT');
      expect(mockedPrisma.report.findMany).toHaveBeenLastCalledWith({
        where: { studentId: 'u-1' },
        orderBy: { generatedAt: 'desc' },
      });
      await listMyReports('u-1', 'TEACHER');
      expect(mockedPrisma.report.findMany).toHaveBeenLastCalledWith({
        where: { teacherId: 'u-1' },
        orderBy: { generatedAt: 'desc' },
      });
    });
  });
});

/**
 * A report PDF is a point-in-time snapshot referenced by a DB row forever —
 * it cannot be re-derived. Written to local disk only, it vanishes on the next
 * deploy of any container/ephemeral host while the row survives, leaving a
 * permanent 404 in the parent's and student's report list.
 */
describe('report.service — generated-PDF durability', () => {
  const stubWriteStream = () =>
    mockedFs.createWriteStream.mockReturnValue({
      on: jest.fn((event: string, cb: () => void) => {
        if (event === 'finish') setTimeout(cb, 0);
        return { on: jest.fn() } as any;
      }),
      write: jest.fn(),
      end: jest.fn(),
      destroy: jest.fn(),
      once: jest.fn(),
      emit: jest.fn(),
      pipe: jest.fn(),
    } as any);

  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockedPrisma));
    mockedPrisma.user.findUnique.mockResolvedValue({
      firstName: 'Ali',
      lastName: 'Ahmad',
      email: 'ali@test.com',
    } as any);
    mockedPrisma.grade.findMany.mockResolvedValue([] as any);
    mockedPrisma.recording.count.mockResolvedValue(0);
    stubWriteStream();
  });

  it('uploads the PDF to the bucket and stores the object key when storage is configured', async () => {
    (storageService.isStorageEnabled as jest.Mock).mockReturnValue(true);

    const result = await generatePDFReport('teacher-1', 'student-1', 'Good progress');

    expect(storageService.putFile).toHaveBeenCalledWith(
      expect.stringContaining('report-student-1'),
      expect.stringMatching(/^reports\/report-student-1-\d+\.pdf$/),
      'application/pdf'
    );
    // Raw key (no leading slash) is what marks a row as bucket-stored.
    expect(result).toMatch(/^reports\/report-student-1-\d+\.pdf$/);
    // The local copy is redundant once the bucket has it.
    expect(mockedFs.promises.unlink).toHaveBeenCalled();
  });

  it('keeps the local path when no bucket is configured', async () => {
    (storageService.isStorageEnabled as jest.Mock).mockReturnValue(false);

    const result = await generatePDFReport('teacher-1', 'student-1', '');

    expect(storageService.putFile).not.toHaveBeenCalled();
    expect(result).toMatch(/^\/reports\//);
  });

  it('falls back to the local path when the bucket is unreachable — the report is still delivered', async () => {
    (storageService.isStorageEnabled as jest.Mock).mockReturnValue(true);
    (storageService.putFile as jest.Mock).mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

    const result = await generatePDFReport('teacher-1', 'student-1', '');

    expect(result).toMatch(/^\/reports\//);
    // The PDF that could not be uploaded must NOT be deleted from disk.
    expect(mockedFs.promises.unlink).not.toHaveBeenCalled();
  });
});
