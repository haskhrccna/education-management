import { halaqaContracts } from '@quran-review/shared';
import { contractClient, expectStatus } from './contract';

export type HalaqaStatus = 'WAITING' | 'LIVE' | 'ENDED';

export interface HalaqaRoom {
  id: string;
  teacherId: string;
  groupId: string | null;
  title: string;
  status: HalaqaStatus;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  teacher: { id: string; firstName: string; lastName: string };
  participants?: { user: { id: string; firstName: string; lastName: string; role: string } }[];
  _count?: { participants: number };
}

export interface HalaqaGroup {
  id: string;
  teacherId: string;
  title: string;
  attendanceThreshold: number;
  currentStreak: number;
  longestStreak: number;
}

export const halaqaApi = {
  list: async (status?: HalaqaStatus): Promise<HalaqaRoom[]> => {
    const res = expectStatus(
      await contractClient.call(halaqaContracts.listRooms, {
        query: status ? ({ status } as never) : undefined,
      }),
      200
    );
    return (res.body as unknown as { data: HalaqaRoom[] }).data;
  },
  create: async (title: string, groupId?: string): Promise<HalaqaRoom> => {
    const res = expectStatus(
      await contractClient.call(halaqaContracts.createRoom, { body: { title, groupId } as never }),
      201
    );
    return (res.body as unknown as { data: HalaqaRoom }).data;
  },
  get: async (id: string): Promise<HalaqaRoom> => {
    const res = expectStatus(await contractClient.call(halaqaContracts.getRoom, { params: { id } }), 200);
    return (res.body as unknown as { data: HalaqaRoom }).data;
  },
  start: async (id: string): Promise<HalaqaRoom> => {
    const res = expectStatus(await contractClient.call(halaqaContracts.startRoom, { params: { id } }), 200);
    return (res.body as unknown as { data: HalaqaRoom }).data;
  },
  end: async (id: string): Promise<HalaqaRoom> => {
    const res = expectStatus(await contractClient.call(halaqaContracts.endRoom, { params: { id } }), 200);
    return (res.body as unknown as { data: HalaqaRoom }).data;
  },
};

export const halaqaGroupsApi = {
  list: async (): Promise<HalaqaGroup[]> => {
    const res = expectStatus(await contractClient.call(halaqaContracts.listGroups), 200);
    return (res.body as unknown as { data: HalaqaGroup[] }).data;
  },
  create: async (title: string, attendanceThreshold: number): Promise<HalaqaGroup> => {
    const res = expectStatus(
      await contractClient.call(halaqaContracts.createGroup, { body: { title, attendanceThreshold } as never }),
      201
    );
    return (res.body as unknown as { data: HalaqaGroup }).data;
  },
  get: async (id: string): Promise<HalaqaGroup> => {
    const res = expectStatus(await contractClient.call(halaqaContracts.getGroup, { params: { id } }), 200);
    return (res.body as unknown as { data: HalaqaGroup }).data;
  },
};
