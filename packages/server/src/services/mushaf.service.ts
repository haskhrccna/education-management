import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import { recordActivity } from './gamification.service';

export const getSurahWithAyahs = async (surahId: number) => {
  const surah = await prisma.surah.findUnique({
    where: { id: surahId },
    include: { ayahs: { orderBy: { number: 'asc' } } },
  });
  if (!surah) throw new AppError(404, 'Surah not found');
  return surah;
};

export const getPage = async (page: number) => {
  const ayahs = await prisma.ayah.findMany({
    where: { page },
    orderBy: [{ surahId: 'asc' }, { number: 'asc' }],
    include: { surah: { select: { number: true, nameAr: true, nameEn: true } } },
  });
  if (ayahs.length === 0) throw new AppError(404, 'Page not found');
  return { page, juz: ayahs[0].juz, ayahs };
};

export const logAyahMemorization = async (
  userId: string,
  surahId: number,
  ayahNumber: number,
  memorized: boolean
) => {
  const ayah = await prisma.ayah.findUnique({ where: { surahId_number: { surahId, number: ayahNumber } } });
  if (!ayah) throw new AppError(404, 'Ayah not found');

  const surah = await prisma.surah.findUnique({ where: { id: surahId }, select: { ayahCount: true } });
  if (!surah) throw new AppError(404, 'Surah not found');

  const existingProgress = await prisma.memorizationProgress.findUnique({
    where: { userId_surahId: { userId, surahId } },
    select: { memorizedAyahs: true, status: true },
  });

  const currentMemorized = existingProgress?.memorizedAyahs ?? 0;
  const nextMemorized = memorized
    ? Math.min(surah.ayahCount, currentMemorized + 1)
    : Math.max(0, currentMemorized - 1);

  const status =
    nextMemorized >= surah.ayahCount ? 'COMPLETE' : nextMemorized > 0 ? 'IN_PROGRESS' : 'NOT_STARTED';

  await prisma.memorizationProgress.upsert({
    where: { userId_surahId: { userId, surahId } },
    create: { userId, surahId, memorizedAyahs: nextMemorized, status, lastRecitedAt: new Date() },
    update: { memorizedAyahs: nextMemorized, status, lastRecitedAt: new Date() },
  });

  try {
    await recordActivity(userId);
  } catch {
    // best-effort
  }

  return { memorizedAyahs: nextMemorized, status };
};
