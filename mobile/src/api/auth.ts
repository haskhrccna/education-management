import apiClient from './client';

export interface AuthUser {
  id: string;
  email: string;
  role: 'student' | 'teacher' | 'admin';
  firstName: string;
  lastName: string;
  status: 'pending' | 'approved' | 'active' | 'banned';
}

export const authApi = {
  login: async (email: string, password: string): Promise<{ user: AuthUser; token: string }> => {
    const res = await apiClient.post('/auth/login', { email, password });
    return res.data;
  },

  register: async (data: {
    email: string;
    password: string;
    role: 'student' | 'teacher';
    firstName: string;
    lastName: string;
  }) => {
    const res = await apiClient.post('/auth/register', data);
    return res.data;
  },

  getProfile: async (): Promise<AuthUser> => {
    const res = await apiClient.get('/users/profile');
    return res.data;
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const res = await apiClient.put('/users/change-password', { currentPassword, newPassword });
    return res.data;
  },
};
