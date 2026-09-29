import { usersContracts } from '@quran-review/shared';
import * as usersService from '../../services/users.service';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const lc = <T extends string>(s: T) => s.toLowerCase() as Lowercase<T>;
type LcRole = 'student' | 'teacher' | 'admin' | 'parent';
type LcStatus = 'pending' | 'approved' | 'active' | 'banned';

const getProfile = defineRoute(usersContracts.getProfile, async ({ userId }) => {
  const user = await usersService.getProfile(userId!);
  return {
    status: 200 as const,
    body: { ...user, role: lc(user.role) as LcRole, status: lc(user.status) as LcStatus },
  };
});

const listTeachers = defineRoute(usersContracts.listTeachers, async () => {
  const teachers = await usersService.listTeachers();
  return { status: 200 as const, body: teachers };
});

const updateProfile = defineRoute(usersContracts.updateProfile, async ({ body, userId }) => {
  const user = await usersService.updateProfile(userId!, { firstName: body.firstName, lastName: body.lastName });
  return {
    status: 200 as const,
    body: { ...user, role: lc(user.role) as LcRole, status: lc(user.status) as LcStatus },
  };
});

const changePassword = defineRoute(usersContracts.changePassword, async ({ body, userId }) => {
  // Other devices are signed out; this one continues with the fresh pair.
  const session = await usersService.changeUserPassword(userId!, body.currentPassword, body.newPassword);
  return { status: 200 as const, body: { message: 'Password changed successfully', ...session } };
});

const saveDeviceToken = defineRoute(usersContracts.saveDeviceToken, async ({ body, userId }) => {
  await usersService.saveDeviceToken(userId!, body.deviceToken);
  return { status: 200 as const, body: { saved: true as const } };
});

export const usersRouter = buildContractRouter(
  [getProfile, listTeachers, updateProfile, changePassword, saveDeviceToken],
  { mountPrefix: '/api/v1/users' }
);
