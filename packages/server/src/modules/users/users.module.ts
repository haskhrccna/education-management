import { usersContracts } from '@quran-review/shared';
import { prisma } from '../../prisma/client';
import { AppError } from '../../middleware/error.middleware';
import { hashPassword, comparePassword } from '../../services/auth.service';
import { logger } from '../../lib/logger';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const lc = <T extends string>(s: T) => s.toLowerCase() as Lowercase<T>;
type LcRole = 'student' | 'teacher' | 'admin' | 'parent';
type LcStatus = 'pending' | 'approved' | 'active' | 'banned';

const getProfile = defineRoute(usersContracts.getProfile, async ({ userId }) => {
  const user = await prisma.user.findUnique({
    where: { id: userId! },
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
  return {
    status: 200 as const,
    body: { ...user, role: lc(user.role) as LcRole, status: lc(user.status) as LcStatus },
  };
});

const listTeachers = defineRoute(usersContracts.listTeachers, async () => {
  const teachers = await prisma.user.findMany({
    where: { role: 'TEACHER', status: 'ACTIVE', deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { firstName: 'asc' },
  });
  return { status: 200 as const, body: teachers };
});

const updateProfile = defineRoute(usersContracts.updateProfile, async ({ body, userId }) => {
  const data: Record<string, string> = {};
  if (body.firstName) data.firstName = body.firstName;
  if (body.lastName) data.lastName = body.lastName;
  const user = await prisma.user.update({
    where: { id: userId! },
    data,
    select: { id: true, email: true, role: true, firstName: true, lastName: true, status: true, createdAt: true },
  });
  return {
    status: 200 as const,
    body: { ...user, role: lc(user.role) as LcRole, status: lc(user.status) as LcStatus },
  };
});

const changePassword = defineRoute(usersContracts.changePassword, async ({ body, userId }) => {
  const user = await prisma.user.findUnique({ where: { id: userId! } });
  if (!user) throw new AppError(404, 'User not found');
  if (!(await comparePassword(body.currentPassword, user.passwordHash))) {
    throw new AppError(401, 'Current password is incorrect');
  }
  const passwordHash = await hashPassword(body.newPassword);
  await prisma.user.update({
    where: { id: userId! },
    data: { passwordHash, passwordChangedAt: new Date() },
  });
  return { status: 200 as const, body: { message: 'Password changed successfully' } };
});

const saveDeviceToken = defineRoute(usersContracts.saveDeviceToken, async ({ body, userId }) => {
  await prisma.user.update({ where: { id: userId! }, data: { deviceToken: body.deviceToken } });
  logger.info({ userId }, 'Device token saved to DB');
  return { status: 200 as const, body: { saved: true as const } };
});

export const usersRouter = buildContractRouter(
  [getProfile, listTeachers, updateProfile, changePassword, saveDeviceToken],
  { mountPrefix: '/api/v1/users' }
);
