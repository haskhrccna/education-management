import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import { notifyNewMessage } from './notification.service';

type MsgType = 'TEXT' | 'FILE' | 'SYSTEM';

export const getConversations = async (userId: string) => {
  // Get all messages where user is sender or receiver, ordered by newest first
  const messages = await prisma.message.findMany({
    where: {
      OR: [{ senderId: userId }, { receiverId: userId }],
    },
    orderBy: { createdAt: 'desc' },
    include: {
      sender: { select: { id: true, firstName: true, lastName: true } },
      receiver: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  // Single query for all unread counts grouped by sender
  const unreadCounts = await prisma.message.groupBy({
    by: ['senderId'],
    where: {
      receiverId: userId,
      readAt: null,
    },
    _count: { id: true },
  });

  const unreadMap = new Map(unreadCounts.map((u) => [u.senderId, u._count.id]));

  // Group by conversation partner (the OTHER person in each message)
  const conversationsMap = new Map<string, any>();

  for (const msg of messages) {
    const partnerId = msg.senderId === userId ? msg.receiverId : msg.senderId;
    const partner = msg.senderId === userId ? msg.receiver : msg.sender;

    if (!conversationsMap.has(partnerId)) {
      conversationsMap.set(partnerId, {
        partner,
        lastMessage: {
          id: msg.id,
          content: msg.content,
          type: msg.type,
          createdAt: msg.createdAt,
          readAt: msg.readAt,
          sentByMe: msg.senderId === userId,
        },
        unreadCount: unreadMap.get(partnerId) || 0,
      });
    }
  }

  return Array.from(conversationsMap.values());
};

export const getMessagesWithUser = async (userId: string, partnerId: string, skip = 0, take = 50) => {
  return await prisma.message.findMany({
    where: {
      OR: [
        { senderId: userId, receiverId: partnerId },
        { senderId: partnerId, receiverId: userId },
      ],
    },
    orderBy: { createdAt: 'desc' },
    skip,
    take,
    include: {
      sender: { select: { id: true, firstName: true, lastName: true } },
      receiver: { select: { id: true, firstName: true, lastName: true } },
    },
  });
};

export const sendMessage = async (
  senderId: string,
  receiverId: string,
  type: MsgType,
  content: string,
  attachmentUrl?: string
) => {
  if (senderId === receiverId) throw new AppError(400, 'Cannot message yourself');

  const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
  if (!receiver) throw new AppError(404, 'Receiver not found');

  const message = await prisma.message.create({
    data: { senderId, receiverId, type: type as MsgType, content, attachmentUrl: attachmentUrl || null },
    include: { sender: { select: { id: true, firstName: true, lastName: true } } },
  });

  // Notify receiver via unified notification service
  await notifyNewMessage(receiverId, message);

  return message;
};

export const markAsRead = async (messageId: string, userId: string) => {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) throw new AppError(404, 'Message not found');
  if (message.receiverId !== userId) throw new AppError(403, 'Permission denied');

  return await prisma.message.update({ where: { id: messageId }, data: { readAt: new Date() } });
};
