// HOLDOUT (M10–M12 typed-client adoption): auth stays on axios. The auth store
// owns the interceptor installation and the credential lifecycle around these
// calls; migrating login/refresh/logout to the contract client is an M13-scope
// decision to make together with retiring the axios client entirely.
import apiClient from './client';

export interface AuthUser {
  id: string;
  email: string;
  role: 'student' | 'teacher' | 'admin';
  firstName: string;
  lastName: string;
  status: 'pending' | 'active' | 'banned';
  assignedTeacher?: { id: string; firstName: string; lastName: string } | null;
  assignedStudents?: { id: string; firstName: string; lastName: string }[];
}

export const authApi = {
  login: async (email: string, password: string): Promise<{ user: AuthUser; token: string; refreshToken: string }> => {
    const res = await apiClient.post('/auth/login', { email, password });
    return res.data;
  },

  register: async (data: { email: string; password: string; role: string; firstName: string; lastName: string }) => {
    const res = await apiClient.post('/auth/register', data);
    return res.data;
  },

  refresh: async (refreshToken: string): Promise<{ token: string; refreshToken: string }> => {
    const res = await apiClient.post('/auth/refresh', { refreshToken });
    return res.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },
};
