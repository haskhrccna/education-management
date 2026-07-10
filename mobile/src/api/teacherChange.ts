import { schedulingContracts, usersContracts } from '@quran-review/shared';
import { contractClient, expectStatus } from './contract';

export const teacherChangeApi = {
  submit: async (reason: string) => {
    const res = expectStatus(
      await contractClient.call(schedulingContracts.submitTeacherChange, { body: { reason } as never }),
      201
    );
    return res.body as unknown;
  },
  list: async (status?: 'PENDING' | 'APPROVED' | 'DENIED') => {
    const res = expectStatus(
      await contractClient.call(schedulingContracts.listTeacherChanges, {
        query: status ? ({ status } as never) : undefined,
      }),
      200
    );
    return res.body as unknown;
  },
  decide: async (id: string, action: 'APPROVE' | 'DENY', adminNote?: string, newTeacherId?: string) => {
    const res = expectStatus(
      await contractClient.call(schedulingContracts.decideTeacherChange, {
        params: { id },
        body: { action, adminNote, newTeacherId } as never,
      }),
      200
    );
    return res.body as unknown;
  },
  listTeachers: async (): Promise<{ id: string; firstName: string; lastName: string }[]> => {
    const res = expectStatus(await contractClient.call(usersContracts.listTeachers), 200);
    return res.body as unknown as { id: string; firstName: string; lastName: string }[];
  },
};
