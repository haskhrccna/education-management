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

export const accountRouter = buildContractRouter([exportMyData, deleteMyAccount], { mountPrefix: '/api/v1/account' });
