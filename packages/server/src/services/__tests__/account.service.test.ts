import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

jest.mock('../admin.service', () => ({
  deleteUser: jest.fn(),
}));

import { prisma } from '../../prisma/client';
import { exportMyData, deleteMyAccount } from '../account.service';
import { deleteUser } from '../admin.service';

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('account.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('exportMyData', () => {
    it('throws 404 when the caller has no user row', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);

      await expect(exportMyData('missing-user')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('is scoped to only the caller — every query filters on the caller userId', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ id: 'student-1', email: 's@x.com' } as any);
      mockedPrisma.appointment.findMany.mockResolvedValue([]);
      mockedPrisma.grade.findMany.mockResolvedValue([]);
      mockedPrisma.recording.findMany.mockResolvedValue([]);
      mockedPrisma.memorizationProgress.findMany.mockResolvedValue([]);
      mockedPrisma.revisionSchedule.findMany.mockResolvedValue([]);
      mockedPrisma.message.findMany.mockResolvedValue([]);
      mockedPrisma.certificate.findMany.mockResolvedValue([]);
      mockedPrisma.ijazah.findMany.mockResolvedValue([]);
      mockedPrisma.streak.findUnique.mockResolvedValue(null);
      mockedPrisma.parentLink.findMany.mockResolvedValue([]);

      const result = await exportMyData('student-1');

      expect(mockedPrisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'student-1' } })
      );
      expect(mockedPrisma.appointment.findMany).toHaveBeenCalledWith({ where: { studentId: 'student-1' } });
      expect(mockedPrisma.appointment.findMany).toHaveBeenCalledWith({ where: { teacherId: 'student-1' } });
      expect(mockedPrisma.grade.findMany).toHaveBeenCalledWith({ where: { studentId: 'student-1' } });
      expect(mockedPrisma.grade.findMany).toHaveBeenCalledWith({ where: { teacherId: 'student-1' } });
      expect(mockedPrisma.recording.findMany).toHaveBeenCalledWith({ where: { studentId: 'student-1' } });
      expect(mockedPrisma.message.findMany).toHaveBeenCalledWith({ where: { senderId: 'student-1' } });
      expect(mockedPrisma.message.findMany).toHaveBeenCalledWith({ where: { receiverId: 'student-1' } });
      expect(mockedPrisma.parentLink.findMany).toHaveBeenCalledWith({ where: { parentId: 'student-1' } });
      expect(mockedPrisma.parentLink.findMany).toHaveBeenCalledWith({ where: { studentId: 'student-1' } });

      expect(result).toMatchObject({
        profile: { id: 'student-1', email: 's@x.com' },
        appointments: { asStudent: [], asTeacher: [] },
        grades: { received: [], given: [] },
        messages: { sent: [], received: [] },
        parentLinks: { asParent: [], asStudent: [] },
      });
      expect(typeof result.exportedAt).toBe('string');
    });
  });

  describe('deleteMyAccount', () => {
    it('delegates to admin.service.deleteUser with the caller own id', async () => {
      (deleteUser as jest.Mock).mockResolvedValue({ id: 'student-1', status: 'BANNED' });

      const result = await deleteMyAccount('student-1');

      expect(deleteUser).toHaveBeenCalledWith('student-1');
      expect(result).toEqual({ id: 'student-1', status: 'BANNED' });
    });
  });
});
