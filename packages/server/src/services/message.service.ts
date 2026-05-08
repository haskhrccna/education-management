import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import { notifyNewMessage } from './notification.service';

type MsgType = 'TEXT' | 'FILE' | 'SYSTEM';
type MessageUser = { id: string; role: string; deletedAt?: Date | null };

async function assertCanCommunicate(sender: MessageUser, receiver: MessageUser) {
  if (sender.role === 'ADMIN' || receiver.role === 'ADMIN') return;

  const isTeacherStudentPair =
    (sender.role === 'TEACHER' && receiver.role === 'STUDENT') ||
    (sender.role === 'STUDENT' && receiver.role === 'TEACHER');

  if (!isTeacherStudentPair) {
    throw new AppError(403, 'Messaging is limited to assigned teacher-student relationships');
  }

  const teacherId = sender.role === 'TEACHER' ? sender.id : receiver.id;
  const studentId = sender.role === 'STUDENT' ? sender.id : receiver.id;
  const appointment = await prisma.appointment.findFirst({
    where: { teacherId, studentId, status: 'ACCEPTED' },
    select: { id: true },
  });
  if (!appointment) throw new AppError(403, 'No accepted appointment with this user');
}

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
  const [user, partner] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, deletedAt: true } }),
    prisma.user.findUnique({ where: { id: partnerId }, select: { id: true, role: true, deletedAt: true } }),
  ]);
  if (!user || user.deletedAt || !partner || partner.deletedAt) throw new AppError(404, 'User not found');
  await assertCanCommunicate(user, partner);

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

  const [sender, receiver] = await Promise.all([
    prisma.user.findUnique({ where: { id: senderId }, select: { id: true, role: true, deletedAt: true } }),
    prisma.user.findUnique({ where: { id: receiverId }, select: { id: true, role: true, deletedAt: true } }),
  ]);
  if (!sender || sender.deletedAt) throw new AppError(404, 'Sender not found');
  if (!receiver || receiver.deletedAt) throw new AppError(404, 'Receiver not found');
  await assertCanCommunicate(sender, receiver);

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
