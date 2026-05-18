import apiClient from './client';

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: string;
  readAt?: string;
  createdAt: string;
  sender?: { id: string; firstName: string; lastName: string };
  receiver?: { id: string; firstName: string; lastName: string };
}

export const messagesApi = {
  getConversations: async (): Promise<Message[]> => {
    const res = await apiClient.get('/messages');
    return res.data;
  },

  send: async (receiverId: string, content: string, type = 'TEXT') => {
    const res = await apiClient.post('/messages', { receiverId, content, type });
    return res.data;
  },

  markRead: async (messageId: string) => {
    const res = await apiClient.put(`/messages/${messageId}/read`);
    return res.data;
  },

  getThread: async (partnerId: string) => {
    const res = await apiClient.get('/messages', { params: { partnerId } });
    return res.data;
  },

  broadcast: async (content: string, targetRole?: 'STUDENT' | 'TEACHER') => {
    const role = targetRole?.toLowerCase() as 'student' | 'teacher' | undefined;
    await apiClient.post('/admin/broadcast', { message: content, targetRole: role });
  },
};
