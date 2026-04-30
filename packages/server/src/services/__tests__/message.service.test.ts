import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from '../../prisma/client';
import { getConversations, sendMessage, markAsRead } from '../message.service';
import { AppError } from '../../middleware/error.middleware';

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('message.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getConversations', () => {
    it('should return messages for user', async () => {
      mockedPrisma.message.findMany.mockResolvedValue([
        { id: 'msg-1', content: 'Hello', senderId: 'user-a', receiverId: 'user-b' },
      ] as any);

      const result = await getConversations('user-a');
      expect(result).toHaveLength(1);
      expect(mockedPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { OR: [{ senderId: 'user-a' }, { receiverId: 'user-a' }] },
          take: 50,
        })
      );
    });
  });

  describe('sendMessage', () => {
    it('should create message and notify receiver', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ id: 'receiver-1' } as any);
      mockedPrisma.message.create.mockResolvedValue({
        id: 'msg-1',
        senderId: 'sender-1',
        receiverId: 'receiver-1',
        content: 'Hello',
      } as any);

      const result = await sendMessage('sender-1', 'receiver-1', 'TEXT', 'Hello');
      expect(result.id).toBe('msg-1');
      expect(mockedPrisma.message.create).toHaveBeenCalled();
    });

    it('should reject self-messaging', async () => {
      await expect(sendMessage('user-1', 'user-1', 'TEXT', 'Hello'))
        .rejects.toThrow('Cannot message yourself');
    });

    it('should reject unknown receiver', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);
      await expect(sendMessage('sender-1', 'unknown', 'TEXT', 'Hello'))
        .rejects.toThrow('Receiver not found');
    });
  });

  describe('markAsRead', () => {
    it('should mark message as read for receiver', async () => {
      mockedPrisma.message.findUnique.mockResolvedValue({
        id: 'msg-1',
        receiverId: 'user-1',
      } as any);
      mockedPrisma.message.update.mockResolvedValue({ id: 'msg-1', readAt: new Date() } as any);

      const result = await markAsRead('msg-1', 'user-1');
      expect(result.id).toBe('msg-1');
    });

    it('should reject non-receiver', async () => {
      mockedPrisma.message.findUnique.mockResolvedValue({
        id: 'msg-1',
        receiverId: 'user-2',
      } as any);

      await expect(markAsRead('msg-1', 'user-1'))
        .rejects.toThrow('Permission denied');
    });

    it('should reject unknown message', async () => {
      mockedPrisma.message.findUnique.mockResolvedValue(null);
      await expect(markAsRead('msg-1', 'user-1'))
        .rejects.toThrow('Message not found');
    });
  });
});
