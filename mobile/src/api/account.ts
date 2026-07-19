import { accountContracts } from '@quran-review/shared';
import { contractClient, expectStatus } from './contract';

export const accountApi = {
  exportMyData: async (): Promise<Record<string, unknown>> => {
    const res = expectStatus(await contractClient.call(accountContracts.exportMyData), 200);
    return (res.body as unknown as { data: Record<string, unknown> }).data;
  },
  deleteMyAccount: async (): Promise<void> => {
    expectStatus(await contractClient.call(accountContracts.deleteMyAccount), 200);
  },
  completeOnboarding: async (): Promise<string> => {
    const res = expectStatus(await contractClient.call(accountContracts.completeOnboarding), 200);
    return (res.body as unknown as { data: { onboardingCompletedAt: string } }).data.onboardingCompletedAt;
  },
};
