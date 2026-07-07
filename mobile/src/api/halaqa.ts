import apiClient from './client';

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
    const res = await apiClient.get('/halaqa', { params: { status } });
    return res.data?.data ?? res.data;
  },
  create: async (title: string, groupId?: string): Promise<HalaqaRoom> => {
    const res = await apiClient.post('/halaqa', { title, groupId });
    return res.data?.data ?? res.data;
  },
  get: async (id: string): Promise<HalaqaRoom> => {
    const res = await apiClient.get(`/halaqa/${id}`);
    return res.data?.data ?? res.data;
  },
  start: async (id: string): Promise<HalaqaRoom> => {
    const res = await apiClient.patch(`/halaqa/${id}/start`);
    return res.data?.data ?? res.data;
  },
  end: async (id: string): Promise<HalaqaRoom> => {
    const res = await apiClient.patch(`/halaqa/${id}/end`);
    return res.data?.data ?? res.data;
  },
};

export const halaqaGroupsApi = {
  list: async (): Promise<HalaqaGroup[]> => {
    const res = await apiClient.get('/halaqa/groups');
    return res.data?.data ?? [];
  },
  create: async (title: string, attendanceThreshold: number): Promise<HalaqaGroup> => {
    const res = await apiClient.post('/halaqa/groups', { title, attendanceThreshold });
    return res.data.data;
  },
  get: async (id: string): Promise<HalaqaGroup> => {
    const res = await apiClient.get(`/halaqa/groups/${id}`);
    return res.data.data;
  },
};
