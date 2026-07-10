import { schedulingContracts } from '@quran-review/shared';
import { contractClient, expectStatus } from './contract';

export interface Appointment {
  id: string;
  studentId: string;
  teacherId: string;
  requestedDate: string;
  requestedTime: string;
  durationMinutes: number;
  status: string;
  teacher?: { id: string; firstName: string; lastName: string; email: string };
  student?: { id: string; firstName: string; lastName: string; email: string };
}

export const appointmentsApi = {
  getMine: async (): Promise<Appointment[]> => {
    const res = expectStatus(await contractClient.call(schedulingContracts.listAppointments), 200);
    return res.body as unknown as Appointment[];
  },

  create: async (data: {
    teacherId: string;
    requestedDate: string;
    requestedTime: string;
    durationMinutes?: number;
  }) => {
    const res = expectStatus(
      await contractClient.call(schedulingContracts.createAppointment, { body: data as never }),
      201
    );
    return res.body as unknown as Appointment;
  },

  manage: async (id: string, action: string, amendedNote?: string) => {
    const res = expectStatus(
      await contractClient.call(schedulingContracts.manageAppointment, {
        params: { id },
        body: { action, amendedNote } as never,
      }),
      200
    );
    return res.body as unknown as Appointment;
  },
};
