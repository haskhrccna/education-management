import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import { hashPassword, comparePassword } from './auth.service';
import { logger } from '../lib/logger';

export const getProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      status: true,
      emailVerifiedAt: true,
      onboardingCompletedAt: true,
      createdAt: true,
      assignedTeacher: { select: { id: true, firstName: true, lastName: true } },
      assignedStudents: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!user) throw new AppError(404, 'User not found');
  return user;
};

export const listTeachers = async () => {
  return prisma.user.findMany({
    where: { role: 'TEACHER', status: 'ACTIVE', deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { firstName: 'asc' },
  });
};

export const updateProfile = async (userId: string, updates: { firstName?: string; lastName?: string }) => {
  const data: Record<string, string> = {};
  if (updates.firstName) data.firstName = updates.firstName;
  if (updates.lastName) data.lastName = updates.lastName;
  return prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, email: true, role: true, firstName: true, lastName: true, status: true, createdAt: true },
  });
};

export const changeUserPassword = async (userId: string, currentPassword: string, newPassword: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found');
  if (!(await comparePassword(currentPassword, user.passwordHash))) {
    throw new AppError(401, 'Current password is incorrect');
  }
  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, passwordChangedAt: new Date() },
  });
};

export const saveDeviceToken = async (userId: string, deviceToken: string): Promise<void> => {
  await prisma.user.update({ where: { id: userId }, data: { deviceToken } });
  logger.info({ userId }, 'Device token saved to DB');
};
