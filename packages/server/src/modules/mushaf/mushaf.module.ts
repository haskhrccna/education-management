import { z } from 'zod';
import { mushafContracts } from '@quran-review/shared';
import * as mushafService from '../../services/mushaf.service';
import { AppError } from '../../middleware/error.middleware';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const surahAyahs = defineRoute(mushafContracts.surahAyahs, async ({ params }) => {
  const surahId = parseInt(String(params.id), 10);
  if (isNaN(surahId)) throw new AppError(400, 'Invalid surah id');
  const data = await mushafService.getSurahWithAyahs(surahId);
  return { status: 200 as const, body: { success: true as const, data } };
});

const page = defineRoute(mushafContracts.page, async ({ params }) => {
  const pageNum = parseInt(String(params.page), 10);
  if (isNaN(pageNum)) throw new AppError(400, 'Invalid page number');
  const data = await mushafService.getPage(pageNum);
  return { status: 200 as const, body: { success: true as const, data } };
});

const logMemorization = defineRoute(mushafContracts.logMemorization, async ({ body, userId }) => {
  const data = await mushafService.logAyahMemorization(userId!, body.surahId, body.ayahNumber, body.memorized);
  // Service types `status` as string (ternary widening) — the contract pins the actual literal union.
  return {
    status: 200 as const,
    body: {
      success: true as const,
      data: data as z.infer<(typeof mushafContracts.logMemorization.responses)[200]>['data'],
    },
  };
});

export const mushafRouter = buildContractRouter([surahAyahs, page, logMemorization], {
  mountPrefix: '/api/v1/mushaf',
});
