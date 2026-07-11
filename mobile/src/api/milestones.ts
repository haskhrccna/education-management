import { milestonesContracts } from '@quran-review/shared';
import { contractClient, expectStatus } from './contract';

export type MilestoneTriggerType =
  'SURAH_COUNT' | 'REVISION_COUNT' | 'STREAK_LENGTH' | 'PLAN_COMPLETION' | 'IJAZAH_ISSUED' | 'HALAQA_ATTENDANCE_COUNT';

export interface MilestoneDefinition {
  id: string;
  badgeCode: string;
  triggerType: MilestoneTriggerType;
  threshold: number;
  active: boolean;
  badge: { code: string; name: string; description: string; iconKey: string };
}

export const milestonesApi = {
  create: async (
    name: string,
    description: string,
    iconKey: string,
    triggerType: MilestoneTriggerType,
    threshold: number
  ): Promise<MilestoneDefinition> => {
    const res = expectStatus(
      await contractClient.call(milestonesContracts.create, {
        body: { name, description, iconKey, triggerType, threshold } as never,
      }),
      201
    );
    return (res.body as unknown as { data: MilestoneDefinition }).data;
  },

  list: async (): Promise<MilestoneDefinition[]> => {
    const res = expectStatus(await contractClient.call(milestonesContracts.list), 200);
    return (res.body as unknown as { data: MilestoneDefinition[] }).data;
  },
};
