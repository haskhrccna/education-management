import apiClient from './client';

export type AtRiskReason = 'MISSED_SESSIONS' | 'STREAK_BROKEN' | 'GRADE_GAP';

export interface RosterHealthRow {
  studentId: string;
  firstName: string;
  lastName: string;
  atRisk: boolean;
  reasons: AtRiskReason[];
}

export const rosterApi = {
  getHealth: async (): Promise<RosterHealthRow[]> => {
    const res = await apiClient.get('/roster/health');
    return res.data?.data ?? [];
  },
};
