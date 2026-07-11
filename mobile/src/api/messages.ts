import { communicationContracts, adminContracts } from '@quran-review/shared';
import { contractClient, expectStatus } from './contract';

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
    // Pinned dual shape: without ?partnerId the server returns conversation
    // summaries; this module has always typed the result loosely as Message[].
    const res = expectStatus(await contractClient.call(communicationContracts.listMessages), 200);
    return res.body as unknown as Message[];
  },

  send: async (receiverId: string, content: string, type = 'TEXT') => {
    const res = expectStatus(
      await contractClient.call(communicationContracts.sendMessage, {
        body: { receiverId, content, type } as never,
      }),
      201
    );
    return res.body as unknown as Message;
  },

  markRead: async (messageId: string) => {
    const res = expectStatus(
      await contractClient.call(communicationContracts.markMessageRead, { params: { id: messageId } }),
      200
    );
    return res.body as unknown;
  },

  getThread: async (partnerId: string) => {
    const res = expectStatus(
      await contractClient.call(communicationContracts.listMessages, { query: { partnerId } as never }),
      200
    );
    return res.body as unknown as Message[];
  },

  broadcast: async (content: string, targetRole?: 'STUDENT' | 'TEACHER') => {
    const role = targetRole?.toLowerCase() as 'student' | 'teacher' | undefined;
    expectStatus(
      await contractClient.call(adminContracts.broadcast, {
        body: { message: content, targetRole: role } as never,
      }),
      200
    );
  },
};
