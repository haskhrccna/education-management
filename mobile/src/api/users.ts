import apiClient from './client';

export interface UserProfile {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  status: string;
  emailVerifiedAt?: string;
  createdAt: string;
}

export const usersApi = {
  getProfile: async (): Promise<UserProfile> => {
    const res = await apiClient.get('/users/profile');
    return res.data;
  },

  listAll: async (): Promise<UserProfile[]> => {
    const res = await apiClient.get('/admin/users', { params: { limit: 200 } });
    return res.data.data ?? res.data;
  },

  updateProfile: async (data: { firstName?: string; lastName?: string }) => {
    const res = await apiClient.put('/users/profile', data);
    return res.data;
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const res = await apiClient.put('/users/change-password', { currentPassword, newPassword });
    return res.data;
  },
};
