import { rosterContracts } from '@quran-review/shared';
import { contractClient, expectStatus } from './contract';

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
    const res = expectStatus(await contractClient.call(rosterContracts.health), 200);
    return (res.body as unknown as { data: RosterHealthRow[] }).data;
  },
};
