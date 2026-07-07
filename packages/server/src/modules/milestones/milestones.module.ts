import { milestonesContracts } from '@quran-review/shared';
import * as milestoneService from '../../services/milestone.service';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const create = defineRoute(milestonesContracts.create, async ({ body }) => {
  const data = await milestoneService.createMilestone(
    body.name,
    body.description,
    body.iconKey,
    body.triggerType,
    body.threshold
  );
  return { status: 201 as const, body: { success: true as const, data } };
});

const list = defineRoute(milestonesContracts.list, async () => {
  const data = await milestoneService.listMilestones();
  return { status: 200 as const, body: { success: true as const, data } };
});

export const milestonesRouter = buildContractRouter([create, list], { mountPrefix: '/api/v1/milestones' });
