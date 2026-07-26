import { prisma } from '../../prisma/client';
import { computeAcademyHealth } from '../academy-health.service';

jest.mock('../../prisma/client', () => ({
  prisma: {
    user: { count: jest.fn(), findMany: jest.fn() },
    appointment: { findMany: jest.fn() },
    streak: { findMany: jest.fn() },
    grade: { groupBy: jest.fn() },
    sessionRecord: { findMany: jest.fn() },
    pageMemorization: { count: jest.fn() },
    revisionSchedule: { count: jest.fn() },
  },
}));

const mockPrisma = prisma as unknown as {
  user: { count: jest.Mock; findMany: jest.Mock };
  appointment: { findMany: jest.Mock };
  streak: { findMany: jest.Mock };
  grade: { groupBy: jest.Mock };
  sessionRecord: { findMany: jest.Mock };
  pageMemorization: { count: jest.Mock };
  revisionSchedule: { count: jest.Mock };
};

describe('computeAcademyHealth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Two students total, one active this week (via a session record fallback below).
    mockPrisma.user.count.mockImplementation(({ where }: any) => {
      if (where.role === 'STUDENT' && !where.OR) return Promise.resolve(2);
      if (where.role === 'STUDENT' && where.OR) return Promise.resolve(1);
      return Promise.resolve(0);
    });
    mockPrisma.user.findMany.mockResolvedValue([]); // no teachers -> empty load
    mockPrisma.appointment.findMany.mockResolvedValue([]);
    mockPrisma.streak.findMany.mockResolvedValue([]);
    mockPrisma.grade.groupBy.mockResolvedValue([]);
    mockPrisma.sessionRecord.findMany.mockResolvedValue([
      { status: 'PRESENT' },
      { status: 'ABSENT' },
      { status: 'LATE' },
    ]);
    mockPrisma.pageMemorization.count.mockResolvedValue(7);
    mockPrisma.revisionSchedule.count.mockImplementation(({ where }: any) => {
      if (where.status === 'COMPLETED') return Promise.resolve(9);
      if (where.status === 'MISSED') return Promise.resolve(1);
      return Promise.resolve(0);
    });
  });

  it('returns all seven required metrics (AC9.1)', async () => {
    const result = await computeAcademyHealth();
    expect(result).toMatchObject({
      totalStudents: 2,
      activeThisWeek: 1,
      activeRatePct: 50,
      pagesMemorizedThisWeek: 7,
      revisionAdherencePct: 90, // 9 / (9+1) * 100
      atRiskCount: 0,
      completionRatePct: 67, // 2 of 3 session records PRESENT/LATE, rounded
    });
    expect(Array.isArray(result.teacherLoad)).toBe(true);
    expect(typeof result.generatedAt).toBe('string');
  });

  it('is 0% adherence, not NaN, when there is no revision history yet', async () => {
    mockPrisma.revisionSchedule.count.mockResolvedValue(0);
    const result = await computeAcademyHealth();
    expect(result.revisionAdherencePct).toBe(0);
  });

  it('is 0% completion, not NaN, when there are no session records yet', async () => {
    mockPrisma.sessionRecord.findMany.mockResolvedValue([]);
    const result = await computeAcademyHealth();
    expect(result.completionRatePct).toBe(0);
  });
});
