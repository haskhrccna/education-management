import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from '../../prisma/client';
import { exportGradesCsv } from '../export.service';

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;

const GRADES_HEADER = 'studentName,studentEmail,teacherName,subject,grade,type,notes,date';

describe('export.service — exportGradesCsv access boundaries', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('rejects a teacher exporting a student they have no accepted appointment with', async () => {
    mockedPrisma.appointment.findFirst.mockResolvedValue(null);
    mockedPrisma.user.findUnique.mockResolvedValue({ deletedAt: null } as any);

    await expect(exportGradesCsv('student-1', undefined, 'teacher-1', 'TEACHER')).rejects.toMatchObject({
      statusCode: 403,
      message: 'No accepted appointment with this student',
    });
    expect(mockedPrisma.grade.findMany).not.toHaveBeenCalled();
  });

  it('rejects a teacher exporting a soft-deleted student despite an accepted appointment', async () => {
    mockedPrisma.appointment.findFirst.mockResolvedValue({ id: 'appt-1' } as any);
    mockedPrisma.user.findUnique.mockImplementation(
      (args: any) =>
        Promise.resolve(
          args.where.id === 'student-1' ? { deletedAt: new Date('2026-01-01') } : { deletedAt: null }
        ) as any
    );

    await expect(exportGradesCsv('student-1', undefined, 'teacher-1', 'TEACHER')).rejects.toMatchObject({
      statusCode: 403,
      message: 'No accepted appointment with this student',
    });
    expect(mockedPrisma.grade.findMany).not.toHaveBeenCalled();
  });

  it("ignores a supplied teacherId and forces the caller's own for teacher callers", async () => {
    mockedPrisma.appointment.findFirst.mockResolvedValue({ id: 'appt-1' } as any);
    mockedPrisma.user.findUnique.mockResolvedValue({ deletedAt: null } as any);
    mockedPrisma.grade.findMany.mockResolvedValue([] as any);

    await exportGradesCsv('student-1', 'other-teacher', 'teacher-1', 'TEACHER');

    expect(mockedPrisma.grade.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ teacherId: 'teacher-1' }),
      })
    );
  });

  it('scopes a teacher export without studentId to their accepted students only', async () => {
    mockedPrisma.appointment.findMany.mockResolvedValue([
      { studentId: 'student-1' },
      { studentId: 'student-2' },
    ] as any);
    mockedPrisma.grade.findMany.mockResolvedValue([] as any);

    await exportGradesCsv(undefined, undefined, 'teacher-1', 'TEACHER');

    expect(mockedPrisma.grade.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          teacherId: 'teacher-1',
          studentId: { in: ['student-1', 'student-2'] },
        }),
      })
    );
  });

  it('returns a header-only CSV for a teacher with no accepted students', async () => {
    mockedPrisma.appointment.findMany.mockResolvedValue([] as any);

    const csv = await exportGradesCsv(undefined, undefined, 'teacher-1', 'TEACHER');

    expect(csv).toBe(GRADES_HEADER);
    expect(mockedPrisma.grade.findMany).not.toHaveBeenCalled();
  });

  it('lets an admin export any student without an appointment check', async () => {
    mockedPrisma.grade.findMany.mockResolvedValue([] as any);

    await exportGradesCsv('student-1', undefined, 'admin-1', 'ADMIN');

    expect(mockedPrisma.appointment.findFirst).not.toHaveBeenCalled();
    expect(mockedPrisma.grade.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ studentId: 'student-1' }) })
    );
  });
});
