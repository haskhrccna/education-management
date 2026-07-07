import apiClient from './client';

export const accountApi = {
  exportMyData: async (): Promise<Record<string, unknown>> => {
    const res = await apiClient.get('/account/data-export');
    return res.data.data;
  },
  deleteMyAccount: async (): Promise<void> => {
    await apiClient.delete('/account');
  },
};
