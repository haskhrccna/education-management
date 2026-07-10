import { recurringSlotsContracts } from '@quran-review/shared';
import { contractClient, expectStatus } from './contract';

export interface RecurringSlot {
  id: string;
  studentId: string;
  teacherId: string;
  dayOfWeek: number;
  time: string;
  durationMinutes: number;
  active: boolean;
}

export interface GeneratedOccurrence {
  date: string;
  created: boolean;
  appointmentId?: string;
  skippedReason?: string;
}

export const recurringSlotsApi = {
  create: async (
    teacherId: string,
    dayOfWeek: number,
    time: string,
    durationMinutes?: number
  ): Promise<{ slot: RecurringSlot; occurrences: GeneratedOccurrence[] }> => {
    const res = expectStatus(
      await contractClient.call(recurringSlotsContracts.create, {
        body: { teacherId, dayOfWeek, time, durationMinutes } as never,
      }),
      201
    );
    return (res.body as unknown as { data: { slot: RecurringSlot; occurrences: GeneratedOccurrence[] } }).data;
  },

  list: async (): Promise<RecurringSlot[]> => {
    const res = expectStatus(await contractClient.call(recurringSlotsContracts.list), 200);
    return (res.body as unknown as { data: RecurringSlot[] }).data;
  },

  cancel: async (id: string): Promise<RecurringSlot> => {
    const res = expectStatus(await contractClient.call(recurringSlotsContracts.cancel, { params: { id } }), 200);
    return (res.body as unknown as { data: RecurringSlot }).data;
  },
};
