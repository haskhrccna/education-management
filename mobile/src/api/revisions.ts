import { learningContracts } from '@quran-review/shared';
import { contractClient, expectStatus } from './contract';

export interface Revision {
  id: string;
  userId: string;
  surahId: number;
  ayahId?: number | null;
  scheduledFor: string;
  status: 'PENDING' | 'COMPLETED' | 'MISSED';
  surah?: { id: number; name: string; englishName: string; juzNumber: number };
  ayah?: { id: number; number: number; text?: string | null } | null;
}

export const revisionsApi = {
  getMyRevisions: async (): Promise<Revision[]> => {
    const res = expectStatus(await contractClient.call(learningContracts.listRevisions), 200);
    return res.body as unknown as Revision[];
  },

  createRevision: async (studentId: string, surahId: number, scheduledFor: string): Promise<Revision> => {
    const res = expectStatus(
      await contractClient.call(learningContracts.createRevision, {
        body: { studentId, surahId, scheduledFor } as never,
      }),
      201
    );
    return res.body as unknown as Revision;
  },

  markRevision: async (id: string, status: 'COMPLETED' | 'MISSED'): Promise<Revision> => {
    const res = expectStatus(
      await contractClient.call(learningContracts.markRevision, {
        params: { id },
        body: { status } as never,
      }),
      200
    );
    return res.body as unknown as Revision;
  },

  deleteRevision: async (id: string): Promise<void> => {
    expectStatus(await contractClient.call(learningContracts.deleteRevision, { params: { id } }), 200);
  },
};
