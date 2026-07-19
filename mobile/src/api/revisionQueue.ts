import { mushafContracts } from '@quran-review/shared';
import { contractClient, expectStatus } from './contract';

export type RevisionBand = 'OVERRIDE' | 'MANZIL' | 'SABQI' | 'SABAQ';

export interface RevisionQueueItem {
  page: number | null;
  surahId: number | null;
  band: RevisionBand;
  overdueDays: number;
}

export interface RevisionQueueResult {
  items: RevisionQueueItem[];
  reviewedThisWeek: number;
}

export const revisionQueueApi = {
  getQueue: async (studentId?: string): Promise<RevisionQueueResult> => {
    const res = expectStatus(
      await contractClient.call(mushafContracts.revisionQueue, {
        query: (studentId ? { studentId } : {}) as never,
      }),
      200
    );
    return (res.body as unknown as { data: RevisionQueueResult }).data;
  },
  markReviewed: async (page: number): Promise<void> => {
    expectStatus(
      await contractClient.call(mushafContracts.pageReviewed, { params: { page: String(page) } as never }),
      200
    );
  },
};
