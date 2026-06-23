import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';

export const createRoom = async (teacherId: string, title: string) => {
  return prisma.halaqaRoom.create({
    data: { teacherId, title },
    include: { teacher: { select: { id: true, firstName: true, lastName: true } } },
  });
};

export const listRooms = async (status?: string) => {
  const where = status
    ? { status: status as 'WAITING' | 'LIVE' | 'ENDED' }
    : { status: { in: ['WAITING', 'LIVE'] as ('WAITING' | 'LIVE')[] } };
  return prisma.halaqaRoom.findMany({
    where,
    include: {
      teacher: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { participants: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const getRoom = async (roomId: string) => {
  const room = await prisma.halaqaRoom.findUnique({
    where: { id: roomId },
    include: {
      teacher: { select: { id: true, firstName: true, lastName: true } },
      participants: {
        where: { leftAt: null },
        include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } },
      },
    },
  });
  if (!room) throw new AppError(404, 'Room not found');
  return room;
};

export const startRoom = async (roomId: string, teacherId: string) => {
  const room = await prisma.halaqaRoom.findUnique({ where: { id: roomId }, select: { teacherId: true, status: true } });
  if (!room) throw new AppError(404, 'Room not found');
  if (room.teacherId !== teacherId) throw new AppError(403, 'Only the room teacher can start this session');
  if (room.status !== 'WAITING') throw new AppError(409, 'Room is not in WAITING state');
  return prisma.halaqaRoom.update({ where: { id: roomId }, data: { status: 'LIVE', startedAt: new Date() } });
};

export const endRoom = async (roomId: string, callerId: string, callerRole: string) => {
  const room = await prisma.halaqaRoom.findUnique({ where: { id: roomId }, select: { teacherId: true, status: true } });
  if (!room) throw new AppError(404, 'Room not found');
  if (room.teacherId !== callerId && callerRole !== 'ADMIN') {
    throw new AppError(403, 'Only the room teacher or an admin can end this session');
  }
  if (room.status === 'ENDED') throw new AppError(409, 'Room is already ended');

  await prisma.halaqaParticipant.updateMany({
    where: { roomId, leftAt: null },
    data: { leftAt: new Date() },
  });
  return prisma.halaqaRoom.update({ where: { id: roomId }, data: { status: 'ENDED', endedAt: new Date() } });
};

export const recordJoin = async (roomId: string, userId: string) => {
  const room = await prisma.halaqaRoom.findUnique({ where: { id: roomId }, select: { status: true } });
  if (!room) throw new AppError(404, 'Room not found');
  if (room.status === 'ENDED') throw new AppError(410, 'Room has ended');

  return prisma.halaqaParticipant.upsert({
    where: { roomId_userId: { roomId, userId } },
    create: { roomId, userId },
    update: { joinedAt: new Date(), leftAt: null },
  });
};

export const recordLeave = async (roomId: string, userId: string) => {
  await prisma.halaqaParticipant.updateMany({
    where: { roomId, userId, leftAt: null },
    data: { leftAt: new Date() },
  });
};
