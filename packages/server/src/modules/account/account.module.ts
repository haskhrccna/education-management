import { accountContracts } from '@quran-review/shared';
import * as accountService from '../../services/account.service';
import { prisma } from '../../prisma/client';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const exportMyData = defineRoute(accountContracts.exportMyData, async ({ userId }) => {
  const data = await accountService.exportMyData(userId!);
  return { status: 200 as const, body: { success: true as const, data } };
});

const deleteMyAccount = defineRoute(accountContracts.deleteMyAccount, async ({ userId }) => {
  const result = await accountService.deleteMyAccount(userId!);
  return { status: 200 as const, body: { success: true as const, data: { id: result.id, deleted: true as const } } };
});

const completeOnboarding = defineRoute(accountContracts.completeOnboarding, async ({ userId }) => {
  // Idempotent: the first call stamps, later calls echo the original stamp
  // (the wizard must be unrepeatable — F5).
  const existing = await prisma.user.findUnique({
    where: { id: userId! },
    select: { onboardingCompletedAt: true },
  });
  const stamped =
    existing?.onboardingCompletedAt ??
    (
      await prisma.user.update({
        where: { id: userId! },
        data: { onboardingCompletedAt: new Date() },
        select: { onboardingCompletedAt: true },
      })
    ).onboardingCompletedAt!;
  return { status: 200 as const, body: { success: true as const, data: { onboardingCompletedAt: stamped } } };
});

export const accountRouter = buildContractRouter([exportMyData, deleteMyAccount, completeOnboarding], {
  mountPrefix: '/api/v1/account',
});
