import { progressContracts } from '@quran-review/shared';
import * as gamificationService from '../../services/gamification.service';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const me = defineRoute(progressContracts.gamificationMe, async ({ userId }) => {
  const data = await gamificationService.getMyGamification(userId!);
  return { status: 200 as const, body: { success: true as const, data } };
});

const leaderboard = defineRoute(progressContracts.leaderboard, async ({ query }) => {
  const scope = typeof query.scope === 'string' ? query.scope : undefined;
  const limit = typeof query.limit === 'string' ? parseInt(query.limit, 10) : 20;
  const data = await gamificationService.getLeaderboard(scope, isNaN(limit) ? 20 : limit);
  return { status: 200 as const, body: { success: true as const, data } };
});

export const gamificationRouter = buildContractRouter([me, leaderboard], { mountPrefix: '/api/v1/gamification' });
