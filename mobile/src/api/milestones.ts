import apiClient from './client';

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
    const res = await apiClient.post('/milestones', { name, description, iconKey, triggerType, threshold });
    return res.data.data;
  },

  list: async (): Promise<MilestoneDefinition[]> => {
    const res = await apiClient.get('/milestones');
    return res.data?.data ?? [];
  },
};
