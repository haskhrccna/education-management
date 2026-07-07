import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';

/**
 * Roadmap 3.4: a persistent named halaqa. attendanceThreshold is the
 * minimum number of distinct participants a session needs to "count"
 * toward the group's collective streak.
 */
export const createGroup = async (teacherId: string, title: string, attendanceThreshold: number) => {
  if (attendanceThreshold <= 0) throw new AppError(400, 'attendanceThreshold must be a positive number');
  return prisma.halaqaGroup.create({ data: { teacherId, title, attendanceThreshold } });
};

export const listGroups = async (teacherId: string) => {
  return prisma.halaqaGroup.findMany({ where: { teacherId }, orderBy: { createdAt: 'desc' } });
};

/** Visible to the owning teacher, anyone who has attended one of its rooms, or an admin. */
export const getGroup = async (groupId: string, callerId: string, callerRole: string) => {
  const group = await prisma.halaqaGroup.findUnique({ where: { id: groupId } });
  if (!group) throw new AppError(404, 'Group not found');
  if (group.teacherId === callerId || callerRole === 'ADMIN') return group;

  const attended = await prisma.halaqaParticipant.findFirst({
    where: { userId: callerId, room: { groupId } },
    select: { id: true },
  });
  if (!attended) throw new AppError(404, 'Group not found');
  return group;
};

export const createRoom = async (teacherId: string, title: string, groupId?: string) => {
  if (groupId) {
    const group = await prisma.halaqaGroup.findUnique({ where: { id: groupId }, select: { teacherId: true } });
    if (!group || group.teacherId !== teacherId) throw new AppError(404, 'Group not found');
  }
  return prisma.halaqaRoom.create({
    data: { teacherId, title, groupId },
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
  const room = await prisma.halaqaRoom.findUnique({
    where: { id: roomId },
    select: { teacherId: true, status: true, groupId: true },
  });
  if (!room) throw new AppError(404, 'Room not found');
  if (room.teacherId !== callerId && callerRole !== 'ADMIN') {
    throw new AppError(403, 'Only the room teacher or an admin can end this session');
  }
  if (room.status === 'ENDED') throw new AppError(409, 'Room is already ended');

  await prisma.halaqaParticipant.updateMany({
    where: { roomId, leftAt: null },
    data: { leftAt: new Date() },
  });
  const updated = await prisma.halaqaRoom.update({
    where: { id: roomId },
    data: { status: 'ENDED', endedAt: new Date() },
  });

  // Best-effort, same isolated-try/catch convention as every other
  // secondary side effect — never blocks the room actually ending.
  if (room.groupId) {
    try {
      await recomputeGroupStreak(room.groupId, roomId);
    } catch {
      /* collective streak is a display nicety, not load-bearing */
    }
  }

  return updated;
};

/** A session "counts" toward the collective streak if it met the group's attendanceThreshold. */
async function recomputeGroupStreak(groupId: string, roomId: string): Promise<void> {
  const [group, attendeeCount] = await Promise.all([
    prisma.halaqaGroup.findUnique({ where: { id: groupId } }),
    prisma.halaqaParticipant.count({ where: { roomId } }),
  ]);
  if (!group) return;

  const met = attendeeCount >= group.attendanceThreshold;
  const nextStreak = met ? group.currentStreak + 1 : 0;
  await prisma.halaqaGroup.update({
    where: { id: groupId },
    data: { currentStreak: nextStreak, longestStreak: Math.max(nextStreak, group.longestStreak) },
  });
}

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
