import { curriculumPlansContracts } from '@quran-review/shared';
import * as planService from '../../services/curriculum-plan.service';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const create = defineRoute(curriculumPlansContracts.create, async ({ body, userId }) => {
  const items = body.items.map((i) => ({ surahId: i.surahId, targetDate: new Date(i.targetDate) }));
  const created = await planService.createPlan(userId!, body.studentId, body.name, items);
  // Re-fetch through getPlan so pace is genuinely computed (not assumed) —
  // a target date already in the past at creation time is BEHIND on day one.
  const data = await planService.getPlan(created.id, userId!, 'TEACHER');
  return { status: 201 as const, body: { success: true as const, data } };
});

const list = defineRoute(curriculumPlansContracts.list, async ({ userId, userRole }) => {
  const data = await planService.listPlans(userId!, userRole as 'STUDENT' | 'TEACHER' | 'ADMIN');
  return { status: 200 as const, body: { success: true as const, data } };
});

const get = defineRoute(curriculumPlansContracts.get, async ({ params, userId, userRole }) => {
  const data = await planService.getPlan(String(params.id), userId!, userRole as 'STUDENT' | 'TEACHER' | 'ADMIN');
  return { status: 200 as const, body: { success: true as const, data } };
});

export const curriculumPlansRouter = buildContractRouter([create, list, get], {
  mountPrefix: '/api/v1/curriculum-plans',
});
