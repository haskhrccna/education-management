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

  it('does not count a student with zero grades and no ACCEPTED appointment as at-risk (regression: 1 student, 0 grades used to → 100% at-risk)', async () => {
    // totalStudents includes a never-approved/never-assigned student who has
    // zero grades — but with no ACCEPTED appointments anywhere, nobody is
    // "enrolled", so atRiskCount must stay 0.
    mockPrisma.user.count.mockResolvedValue(1);
    mockPrisma.appointment.findMany.mockResolvedValue([]);
    // Guards against regressing to the old, unscoped query shape: the buggy
    // implementation queried `{ role: 'STUDENT', deletedAt: null }` with no
    // id filter and would have picked up this student directly.
    mockPrisma.user.findMany.mockImplementation(({ where }: any) => {
      if (where.role === 'TEACHER') return Promise.resolve([]);
      if (where.role === 'STUDENT' && !where.id) {
        return Promise.resolve([{ id: 'unenrolled-student' }]);
      }
      return Promise.resolve([]);
    });

    const result = await computeAcademyHealth();
    expect(result.totalStudents).toBe(1);
    expect(result.atRiskCount).toBe(0);
  });
});

jest.mock('../../lib/redis', () => ({ cacheGet: jest.fn(), cacheSet: jest.fn() }));
import { cacheGet, cacheSet } from '../../lib/redis';
import { getAcademyHealth } from '../academy-health.service';

const mockCacheGet = cacheGet as jest.Mock;
const mockCacheSet = cacheSet as jest.Mock;

describe('getAcademyHealth (cache-aside)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.user.count.mockResolvedValue(0);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.sessionRecord.findMany.mockResolvedValue([]);
    mockPrisma.pageMemorization.count.mockResolvedValue(0);
    mockPrisma.revisionSchedule.count.mockResolvedValue(0);
    mockPrisma.streak.findMany.mockResolvedValue([]);
    mockPrisma.grade.groupBy.mockResolvedValue([]);
  });

  it('returns the cached value without touching Prisma on a cache hit', async () => {
    const cached = { totalStudents: 99, generatedAt: 'cached' } as any;
    mockCacheGet.mockResolvedValue(cached);
    const result = await getAcademyHealth();
    expect(result).toBe(cached);
    expect(mockPrisma.user.count).not.toHaveBeenCalled();
  });

  it('computes fresh and writes the cache on a cache miss (AC9.2)', async () => {
    mockCacheGet.mockResolvedValue(null);
    const result = await getAcademyHealth();
    expect(result.totalStudents).toBe(0);
    expect(mockCacheSet).toHaveBeenCalledWith('academy-health', expect.any(Object), 3600);
  });
});
