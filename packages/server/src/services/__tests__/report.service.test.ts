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
    },
  };
});

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from '../../prisma/client';
import { generatePDFReport } from '../report.service';

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
        { subject: 'Math', grade: '95', type: 'EXAM', notes: 'Great', createdAt: new Date() },
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
});
