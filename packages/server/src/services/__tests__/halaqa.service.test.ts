import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from '../../prisma/client';
import { startRoom, endRoom, recordJoin } from '../halaqa.service';

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('halaqa.service', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('startRoom', () => {
    it('rejects a teacher who does not own the room', async () => {
      mockedPrisma.halaqaRoom.findUnique.mockResolvedValue({
        teacherId: 'teacher-owner',
        status: 'WAITING',
      } as any);

      await expect(startRoom('room-1', 'teacher-intruder')).rejects.toMatchObject({
        statusCode: 403,
        message: 'Only the room teacher can start this session',
      });
      expect(mockedPrisma.halaqaRoom.update).not.toHaveBeenCalled();
    });

    it('rejects starting a room that is not WAITING', async () => {
      mockedPrisma.halaqaRoom.findUnique.mockResolvedValue({
        teacherId: 'teacher-owner',
        status: 'LIVE',
      } as any);

      await expect(startRoom('room-1', 'teacher-owner')).rejects.toMatchObject({
        statusCode: 409,
        message: 'Room is not in WAITING state',
      });
      expect(mockedPrisma.halaqaRoom.update).not.toHaveBeenCalled();
    });

    it('rejects an unknown room', async () => {
      mockedPrisma.halaqaRoom.findUnique.mockResolvedValue(null);

      await expect(startRoom('room-missing', 'teacher-owner')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('lets the owning teacher take a WAITING room live', async () => {
      mockedPrisma.halaqaRoom.findUnique.mockResolvedValue({
        teacherId: 'teacher-owner',
        status: 'WAITING',
      } as any);
      mockedPrisma.halaqaRoom.update.mockResolvedValue({ id: 'room-1', status: 'LIVE' } as any);

      const result = await startRoom('room-1', 'teacher-owner');

      expect(result.status).toBe('LIVE');
      expect(mockedPrisma.halaqaRoom.update).toHaveBeenCalledWith({
        where: { id: 'room-1' },
        data: expect.objectContaining({ status: 'LIVE' }),
      });
    });
  });

  describe('endRoom', () => {
    it('rejects a non-owner non-admin caller', async () => {
      mockedPrisma.halaqaRoom.findUnique.mockResolvedValue({
        teacherId: 'teacher-owner',
        status: 'LIVE',
      } as any);

      await expect(endRoom('room-1', 'teacher-intruder', 'TEACHER')).rejects.toMatchObject({
        statusCode: 403,
        message: 'Only the room teacher or an admin can end this session',
      });
      expect(mockedPrisma.halaqaRoom.update).not.toHaveBeenCalled();
      expect(mockedPrisma.halaqaParticipant.updateMany).not.toHaveBeenCalled();
    });

    it('lets an admin who is not the owner end the session', async () => {
      mockedPrisma.halaqaRoom.findUnique.mockResolvedValue({
        teacherId: 'teacher-owner',
        status: 'LIVE',
      } as any);
      mockedPrisma.halaqaParticipant.updateMany.mockResolvedValue({ count: 2 } as any);
      mockedPrisma.halaqaRoom.update.mockResolvedValue({ id: 'room-1', status: 'ENDED' } as any);

      const result = await endRoom('room-1', 'admin-1', 'ADMIN');

      expect(result.status).toBe('ENDED');
    });

    it('lets the owning teacher end the session and closes open participants', async () => {
      mockedPrisma.halaqaRoom.findUnique.mockResolvedValue({
        teacherId: 'teacher-owner',
        status: 'LIVE',
      } as any);
      mockedPrisma.halaqaParticipant.updateMany.mockResolvedValue({ count: 3 } as any);
      mockedPrisma.halaqaRoom.update.mockResolvedValue({ id: 'room-1', status: 'ENDED' } as any);

      await endRoom('room-1', 'teacher-owner', 'TEACHER');

      expect(mockedPrisma.halaqaParticipant.updateMany).toHaveBeenCalledWith({
        where: { roomId: 'room-1', leftAt: null },
        data: { leftAt: expect.any(Date) },
      });
    });

    it('rejects ending a room that is already ENDED, even for the owner', async () => {
      mockedPrisma.halaqaRoom.findUnique.mockResolvedValue({
        teacherId: 'teacher-owner',
        status: 'ENDED',
      } as any);

      await expect(endRoom('room-1', 'teacher-owner', 'TEACHER')).rejects.toMatchObject({
        statusCode: 409,
        message: 'Room is already ended',
      });
      expect(mockedPrisma.halaqaParticipant.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('recordJoin', () => {
    it('rejects joining an ENDED room', async () => {
      mockedPrisma.halaqaRoom.findUnique.mockResolvedValue({ status: 'ENDED' } as any);

      await expect(recordJoin('room-1', 'student-1')).rejects.toMatchObject({
        statusCode: 410,
        message: 'Room has ended',
      });
      expect(mockedPrisma.halaqaParticipant.upsert).not.toHaveBeenCalled();
    });

    it('rejects joining an unknown room', async () => {
      mockedPrisma.halaqaRoom.findUnique.mockResolvedValue(null);

      await expect(recordJoin('room-missing', 'student-1')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('re-joining reopens the participation record (clears leftAt)', async () => {
      mockedPrisma.halaqaRoom.findUnique.mockResolvedValue({ status: 'LIVE' } as any);
      mockedPrisma.halaqaParticipant.upsert.mockResolvedValue({ id: 'part-1' } as any);

      await recordJoin('room-1', 'student-1');

      expect(mockedPrisma.halaqaParticipant.upsert).toHaveBeenCalledWith({
        where: { roomId_userId: { roomId: 'room-1', userId: 'student-1' } },
        create: { roomId: 'room-1', userId: 'student-1' },
        update: { joinedAt: expect.any(Date), leftAt: null },
      });
    });
  });
});
