import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../../prisma/client';
import * as mushafService from '../mushaf.service';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('mushaf.service', () => {
  const surah = {
    id: 999001,
    number: 999,
    nameAr: 'اختبار',
    nameEn: 'Test Surah',
    juz: 1,
    ayahCount: 7,
    pages: [1],
    ayahs: Array.from({ length: 7 }, (_, i) => ({
      id: 1000 + i,
      number: i + 1,
      surahId: 999001,
      page: 1,
      juz: 1,
      audioUrl: null,
      text: null,
      createdAt: new Date(),
    })),
    createdAt: new Date(),
    updatedAt: new Date(),
    memorizationProgresses: [],
    revisionSchedules: [],
    grades: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getSurahWithAyahs returns ayahs ordered', async () => {
    mockedPrisma.surah.findUnique.mockResolvedValue(surah as any);
    const result = await mushafService.getSurahWithAyahs(999001);
    expect(result.ayahs.length).toBe(7);
    expect(result.ayahs[0].number).toBe(1);
    expect(result.ayahs[6].number).toBe(7);
    expect(mockedPrisma.surah.findUnique).toHaveBeenCalledWith({
      where: { id: 999001 },
      include: { ayahs: { orderBy: { number: 'asc' } } },
    });
  });

  test('getPage returns ayahs on a page', async () => {
    mockedPrisma.ayah.findMany.mockResolvedValue(surah.ayahs as any);
    const result = await mushafService.getPage(1);
    expect(result.page).toBe(1);
    expect(result.ayahs.length).toBe(7);
    expect(mockedPrisma.ayah.findMany).toHaveBeenCalledWith({
      where: { page: 1 },
      orderBy: [{ surahId: 'asc' }, { number: 'asc' }],
      include: { surah: { select: { number: true, nameAr: true, nameEn: true } } },
    });
  });

  test('logAyahMemorization increments and updates status', async () => {
    mockedPrisma.ayah.findUnique.mockResolvedValue(surah.ayahs[0] as any);
    mockedPrisma.surah.findUnique.mockResolvedValue({ ayahCount: 7 } as any);
    mockedPrisma.memorizationProgress.findUnique.mockResolvedValue(null);
    mockedPrisma.memorizationProgress.upsert.mockResolvedValue({
      id: 'progress-1',
      userId: 'user-1',
      surahId: 999001,
      memorizedAyahs: 1,
      status: 'IN_PROGRESS',
    } as any);

    const result = await mushafService.logAyahMemorization('user-1', 999001, 1, true);
    expect(result.memorizedAyahs).toBe(1);
    expect(result.status).toBe('IN_PROGRESS');
    expect(mockedPrisma.memorizationProgress.upsert).toHaveBeenCalled();
  });

  test('logAyahMemorization decrements when unmemorized', async () => {
    mockedPrisma.ayah.findUnique.mockResolvedValue(surah.ayahs[0] as any);
    mockedPrisma.surah.findUnique.mockResolvedValue({ ayahCount: 7 } as any);
    mockedPrisma.memorizationProgress.findUnique.mockResolvedValue({
      memorizedAyahs: 1,
      status: 'IN_PROGRESS',
    } as any);
    mockedPrisma.memorizationProgress.upsert.mockResolvedValue({
      id: 'progress-1',
      userId: 'user-1',
      surahId: 999001,
      memorizedAyahs: 0,
      status: 'NOT_STARTED',
    } as any);

    const result = await mushafService.logAyahMemorization('user-1', 999001, 1, false);
    expect(result.memorizedAyahs).toBe(0);
    expect(result.status).toBe('NOT_STARTED');
  });
});
