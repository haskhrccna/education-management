import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';

export const getSurahs = async () => {
  return prisma.surah.findMany({ orderBy: { number: 'asc' } });
};

export const getProgress = async (callerId: string, callerRole: string, studentId?: string) => {
  const targetId = callerRole === 'STUDENT' ? callerId : studentId;
  if (!targetId) throw new AppError(400, 'studentId query param is required');
  return prisma.memorizationProgress.findMany({
    where: { userId: targetId },
    include: { surah: true },
    orderBy: { surah: { number: 'asc' } },
  });
};

export const updateProgress = async (
  teacherId: string,
  surahId: number,
  studentId: string,
  memorizedAyahs: number,
  status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE'
) => {
  const appointment = await prisma.appointment.findFirst({
    where: { teacherId, studentId, status: 'ACCEPTED' },
  });
  if (!appointment) throw new AppError(403, 'No accepted appointment with this student');

  const surah = await prisma.surah.findUnique({ where: { id: surahId } });
  if (!surah) throw new AppError(404, 'Surah not found');

  const resolvedStatus =
    status ??
    (memorizedAyahs >= surah.ayahCount
      ? 'COMPLETE'
      : memorizedAyahs > 0
        ? 'IN_PROGRESS'
        : 'NOT_STARTED');

  return prisma.memorizationProgress.upsert({
    where: { userId_surahId: { userId: studentId, surahId } },
    create: { userId: studentId, surahId, memorizedAyahs, status: resolvedStatus },
    update: { memorizedAyahs, status: resolvedStatus, lastRecitedAt: new Date() },
    include: { surah: true },
  });
};
