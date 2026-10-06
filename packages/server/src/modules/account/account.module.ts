import { accountContracts } from '@quran-review/shared';
import * as accountService from '../../services/account.service';
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
  // (the wizard must be unrepeatable — F5). The read-then-write this handler
  // used to do lived here, in the route layer, and could stamp twice.
  const onboardingCompletedAt = await accountService.completeOnboarding(userId!);
  return { status: 200 as const, body: { success: true as const, data: { onboardingCompletedAt } } };
});

export const accountRouter = buildContractRouter([exportMyData, deleteMyAccount, completeOnboarding], {
  mountPrefix: '/api/v1/account',
});
