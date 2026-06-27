import apiClient from './client';

export type HalaqaStatus = 'WAITING' | 'LIVE' | 'ENDED';

export interface HalaqaRoom {
  id: string;
  teacherId: string;
  title: string;
  status: HalaqaStatus;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  teacher: { id: string; firstName: string; lastName: string };
  participants?: { user: { id: string; firstName: string; lastName: string; role: string } }[];
  _count?: { participants: number };
}

export const halaqaApi = {
  list: async (status?: HalaqaStatus): Promise<HalaqaRoom[]> => {
    const res = await apiClient.get('/halaqa', { params: { status } });
    return res.data?.data ?? res.data;
  },
  create: async (title: string): Promise<HalaqaRoom> => {
    const res = await apiClient.post('/halaqa', { title });
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
