import { rosterContracts } from '@quran-review/shared';
import * as rosterService from '../../services/roster.service';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const health = defineRoute(rosterContracts.health, async ({ userId }) => {
  const data = await rosterService.getRosterHealth(userId!);
  return { status: 200 as const, body: { success: true as const, data } };
});

export const rosterRouter = buildContractRouter([health], { mountPrefix: '/api/v1/roster' });
