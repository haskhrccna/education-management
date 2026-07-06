import { learningContracts } from '@quran-review/shared';
import * as memorizationService from '../../services/memorization.service';
import { AppError } from '../../middleware/error.middleware';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const getMemorization = defineRoute(learningContracts.getMemorization, async ({ query, userId, userRole }) => {
  const studentId = query.studentId as string | undefined;
  const progress = await memorizationService.getProgress(userId!, userRole!, studentId);
  return { status: 200 as const, body: progress };
});

const updateMemorization = defineRoute(learningContracts.updateMemorization, async ({ params, userId, req }) => {
  // Legacy parity: hand-validation, exact messages pinned by learning-flows.
  const surahId = parseInt(String(params.surahId), 10);
  if (isNaN(surahId)) throw new AppError(400, 'Invalid surahId');
  const { studentId, memorizedAyahs, status } = (req.body ?? {}) as {
    studentId?: string;
    memorizedAyahs?: unknown;
    status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE';
  };
  if (!studentId) throw new AppError(400, 'studentId is required');
  if (typeof memorizedAyahs !== 'number') throw new AppError(400, 'memorizedAyahs must be a number');
  const result = await memorizationService.updateProgress(userId!, surahId, studentId, memorizedAyahs, status);
  return { status: 200 as const, body: result };
});

export const memorizationRouter = buildContractRouter([getMemorization, updateMemorization], {
  mountPrefix: '/api/v1/memorization',
});
