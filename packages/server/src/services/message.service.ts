import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';

type MsgType = 'TEXT' | 'FILE' | 'SYSTEM';

export const getConversations = async (userId: string) => {
  const messages = await prisma.message.findMany({
    where: {
      OR: [{ senderId: userId }, { receiverId: userId }],
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      sender: { select: { id: true, firstName: true, lastName: true } },
      receiver: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  return messages;
};

export const sendMessage = async (senderId: string, receiverId: string, type: MsgType, content: string, attachmentUrl?: string) => {
  if (senderId === receiverId) throw new AppError(400, 'Cannot message yourself');

  const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
  if (!receiver) throw new AppError(404, 'Receiver not found');

  const message = await prisma.message.create({
    data: { senderId, receiverId, type: type as MsgType, content, attachmentUrl: attachmentUrl || null },
    include: { sender: { select: { id: true, firstName: true, lastName: true } } },
  });

  // Emit real-time via Socket.io
  const { notifyNewMessage } = await import('./socket.service');
  notifyNewMessage(receiverId, message);

  return message;
};

export const markAsRead = async (messageId: string, userId: string) => {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) throw new AppError(404, 'Message not found');
  if (message.receiverId !== userId) throw new AppError(403, 'Permission denied');

  return await prisma.message.update({ where: { id: messageId }, data: { readAt: new Date() } });
};
