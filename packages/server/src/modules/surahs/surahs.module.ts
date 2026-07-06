import { learningContracts } from '@quran-review/shared';
import * as memorizationService from '../../services/memorization.service';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const listSurahs = defineRoute(learningContracts.listSurahs, async () => {
  const surahs = await memorizationService.getSurahs();
  return { status: 200 as const, body: surahs };
});

export const surahsRouter = buildContractRouter([listSurahs], { mountPrefix: '/api/v1/surahs' });
