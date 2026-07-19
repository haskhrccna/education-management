import { mushafContracts } from '@quran-review/shared';
import { contractClient, expectStatus } from './contract';

export type PageStatus = 'NOT_STARTED' | 'LEARNING' | 'MEMORIZED' | 'SOLID';

export interface PageMemorizationRow {
  page: number;
  status: PageStatus;
  lastReviewedAt: string | null;
}

export const mushafPagesApi = {
  getMyPages: async (studentId?: string): Promise<PageMemorizationRow[]> => {
    const res = expectStatus(
      await contractClient.call(mushafContracts.myPages, {
        query: (studentId ? { studentId } : {}) as never,
      }),
      200
    );
    return (res.body as unknown as { data: PageMemorizationRow[] }).data;
  },
  setPageStatus: async (page: number, status: PageStatus): Promise<PageMemorizationRow> => {
    const res = expectStatus(
      await contractClient.call(mushafContracts.setPageStatus, {
        params: { page: String(page) } as never,
        body: { status } as never,
      }),
      200
    );
    return (res.body as unknown as { data: PageMemorizationRow }).data;
  },
};
