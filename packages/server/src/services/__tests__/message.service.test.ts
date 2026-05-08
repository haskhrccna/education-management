import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

jest.mock('../notification.service', () => ({
  notifyNewMessage: jest.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../../prisma/client';
import { getConversations, getMessagesWithUser, sendMessage, markAsRead } from '../message.service';

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('message.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getConversations', () => {
    it('should return conversations grouped by partner', async () => {
      mockedPrisma.message.findMany.mockResolvedValue([
        { id: 'msg-1', content: 'Hello', senderId: 'user-a', receiverId: 'user-b' },
      ] as any);
      (mockedPrisma.message.groupBy as any).mockResolvedValue([]);

      const result = await getConversations('user-a');
      expect(result).toHaveLength(1);
      expect(mockedPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { OR: [{ senderId: 'user-a' }, { receiverId: 'user-a' }] },
        })
      );
    });
  });

  describe('sendMessage', () => {
    it('should create message and notify receiver', async () => {
      mockedPrisma.user.findUnique
        .mockResolvedValueOnce({ id: 'sender-1', role: 'TEACHER' } as any)
        .mockResolvedValueOnce({ id: 'receiver-1', role: 'STUDENT' } as any);
      mockedPrisma.appointment.findFirst.mockResolvedValue({ id: 'appointment-1' } as any);
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
      await expect(sendMessage('user-1', 'user-1', 'TEXT', 'Hello')).rejects.toThrow('Cannot message yourself');
    });

    it('should reject unknown receiver', async () => {
      mockedPrisma.user.findUnique
        .mockResolvedValueOnce({ id: 'sender-1', role: 'TEACHER' } as any)
        .mockResolvedValueOnce(null);
      await expect(sendMessage('sender-1', 'unknown', 'TEXT', 'Hello')).rejects.toThrow('Receiver not found');
    });

    it('should reject users without an accepted appointment', async () => {
      mockedPrisma.user.findUnique
        .mockResolvedValueOnce({ id: 'sender-1', role: 'TEACHER' } as any)
        .mockResolvedValueOnce({ id: 'receiver-1', role: 'STUDENT' } as any);
      mockedPrisma.appointment.findFirst.mockResolvedValue(null);

      await expect(sendMessage('sender-1', 'receiver-1', 'TEXT', 'Hello')).rejects.toThrow(
        'No accepted appointment with this user'
      );
      expect(mockedPrisma.message.create).not.toHaveBeenCalled();
    });

    it('should allow admin messages without an appointment', async () => {
      mockedPrisma.user.findUnique
        .mockResolvedValueOnce({ id: 'admin-1', role: 'ADMIN' } as any)
        .mockResolvedValueOnce({ id: 'receiver-1', role: 'STUDENT' } as any);
      mockedPrisma.message.create.mockResolvedValue({ id: 'msg-1' } as any);

      const result = await sendMessage('admin-1', 'receiver-1', 'TEXT', 'Hello');

      expect(result.id).toBe('msg-1');
      expect(mockedPrisma.appointment.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('getMessagesWithUser', () => {
    it('should return thread for an assigned teacher-student pair', async () => {
      mockedPrisma.user.findUnique
        .mockResolvedValueOnce({ id: 'teacher-1', role: 'TEACHER' } as any)
        .mockResolvedValueOnce({ id: 'student-1', role: 'STUDENT' } as any);
      mockedPrisma.appointment.findFirst.mockResolvedValue({ id: 'appointment-1' } as any);
      mockedPrisma.message.findMany.mockResolvedValue([{ id: 'msg-1' }] as any);

      const result = await getMessagesWithUser('teacher-1', 'student-1');

      expect(result).toHaveLength(1);
    });

    it('should reject thread access without an accepted appointment', async () => {
      mockedPrisma.user.findUnique
        .mockResolvedValueOnce({ id: 'teacher-1', role: 'TEACHER' } as any)
        .mockResolvedValueOnce({ id: 'student-1', role: 'STUDENT' } as any);
      mockedPrisma.appointment.findFirst.mockResolvedValue(null);

      await expect(getMessagesWithUser('teacher-1', 'student-1')).rejects.toThrow(
        'No accepted appointment with this user'
      );
      expect(mockedPrisma.message.findMany).not.toHaveBeenCalled();
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

      await expect(markAsRead('msg-1', 'user-1')).rejects.toThrow('Permission denied');
    });

    it('should reject unknown message', async () => {
      mockedPrisma.message.findUnique.mockResolvedValue(null);
      await expect(markAsRead('msg-1', 'user-1')).rejects.toThrow('Message not found');
    });
  });
});
