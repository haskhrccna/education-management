import { z } from 'zod';
import { mushafContracts } from '@quran-review/shared';
import * as mushafService from '../../services/mushaf.service';
import * as pageMemorizationService from '../../services/page-memorization.service';
import * as revisionQueueService from '../../services/revision-queue.service';
import { AppError } from '../../middleware/error.middleware';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

type Role = 'STUDENT' | 'TEACHER' | 'ADMIN' | 'PARENT';

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

const myPages = defineRoute(mushafContracts.myPages, async ({ query, userId, userRole }) => {
  const data = await pageMemorizationService.getPages(
    userId!,
    userRole as Role,
    (query as { studentId?: string } | undefined)?.studentId
  );
  return { status: 200 as const, body: { success: true as const, data } };
});

const setPageStatus = defineRoute(mushafContracts.setPageStatus, async ({ params, body, userId, userRole }) => {
  const pageNum = parseInt(String(params.page), 10);
  const data = await pageMemorizationService.setPageStatus(
    userId!,
    userRole as Role,
    pageNum,
    body.status,
    body.studentId
  );
  return { status: 200 as const, body: { success: true as const, data } };
});

const revisionQueue = defineRoute(mushafContracts.revisionQueue, async ({ query, userId, userRole }) => {
  const data = await revisionQueueService.getRevisionQueue(
    userId!,
    userRole as Role,
    (query as { studentId?: string } | undefined)?.studentId
  );
  // looseObject rows carry an index signature the service interface doesn't —
  // same widening cast precedent as logMemorization above.
  return {
    status: 200 as const,
    body: {
      success: true as const,
      data: data as z.infer<(typeof mushafContracts.revisionQueue.responses)[200]>['data'],
    },
  };
});

const pageReviewed = defineRoute(mushafContracts.pageReviewed, async ({ params, userId }) => {
  const pageNum = parseInt(String(params.page), 10);
  const data = await pageMemorizationService.markPageReviewed(userId!, pageNum);
  // Prisma types lastReviewedAt as nullable; markPageReviewed always stamps it.
  return {
    status: 200 as const,
    body: {
      success: true as const,
      data: data as z.infer<(typeof mushafContracts.pageReviewed.responses)[200]>['data'],
    },
  };
});

export const mushafRouter = buildContractRouter(
  [surahAyahs, page, logMemorization, myPages, setPageStatus, revisionQueue, pageReviewed],
  {
    mountPrefix: '/api/v1/mushaf',
  }
);
