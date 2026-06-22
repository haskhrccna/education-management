import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

jest.mock('../socket.service', () => ({
  sendToUser: jest.fn(),
}));

import { prisma } from '../../prisma/client';
import { bulkApproveStudents, bulkDeactivateUsers, getUserById, updateUser, deleteUser } from '../admin.service';

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;

// Make $transaction(callback) invoke the callback with a tx that proxies to
// the mocked prisma client (so tx.user.* === prisma.user.*).
function wireTransaction() {
  mockedPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockedPrisma));
}

describe('admin.service — extended coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('bulkApproveStudents', () => {
    it('throws 400 when the array is empty', async () => {
      await expect(bulkApproveStudents([])).rejects.toMatchObject({ statusCode: 400 });
    });

    it('throws 400 when exceeding the max bulk size', async () => {
      const tooMany = Array.from({ length: 1001 }, (_, i) => `s-${i}`);
      await expect(bulkApproveStudents(tooMany)).rejects.toMatchObject({ statusCode: 400 });
    });

    it('approves found pending students and reports per-id outcomes', async () => {
      wireTransaction();
      mockedPrisma.user.findMany.mockResolvedValue([
        { id: 's-1', email: 'a@b.com', firstName: 'A', status: 'PENDING' },
        { id: 's-2', email: 'c@d.com', firstName: 'C', status: 'ACTIVE' },
      ] as any);
      mockedPrisma.user.update.mockResolvedValue({ id: 's-1' } as any);

      const results = await bulkApproveStudents(['s-1', 's-2', 's-3']);

      expect(results).toEqual([
        { id: 's-1', success: true },
        { id: 's-2', success: false, reason: 'Already active' },
        { id: 's-3', success: false, reason: 'Student not found' },
      ]);
      expect(mockedPrisma.user.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('bulkDeactivateUsers', () => {
    it('throws 400 for an empty array', async () => {
      await expect(bulkDeactivateUsers([])).rejects.toMatchObject({ statusCode: 400 });
    });

    it('bans found users and flags missing ones', async () => {
      wireTransaction();
      mockedPrisma.user.findMany.mockResolvedValue([{ id: 'u-1' }] as any);
      mockedPrisma.user.update.mockResolvedValue({ id: 'u-1' } as any);

      const results = await bulkDeactivateUsers(['u-1', 'u-2']);

      expect(results).toEqual([
        { id: 'u-1', success: true },
        { id: 'u-2', success: false, reason: 'User not found' },
      ]);
      expect(mockedPrisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'BANNED' } }));
    });
  });

  describe('getUserById', () => {
    it('throws 404 when the user does not exist', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);
      await expect(getUserById('ghost')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('computes analytics and de-duplicates teachers for a student', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({
        id: 'student-1',
        email: 's@test.com',
        firstName: 'S',
        lastName: 'T',
        role: 'STUDENT',
        status: 'ACTIVE',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-06-01'),
        emailVerifiedAt: null,
        appointmentsAsStudent: [
          {
            id: 'a-1',
            status: 'ACCEPTED',
            requestedDate: new Date(),
            createdAt: new Date(),
            teacher: { id: 't-1', firstName: 'Te', lastName: 'A', email: 't@a.com' },
          },
          {
            id: 'a-2',
            status: 'REQUESTED',
            requestedDate: new Date(),
            createdAt: new Date(),
            teacher: { id: 't-1', firstName: 'Te', lastName: 'A', email: 't@a.com' }, // duplicate
          },
        ],
        appointmentsAsTeacher: [],
        gradesReceived: [
          { id: 'g-1', grade: '90', type: 'EXAM' },
          { id: 'g-2', grade: '80', type: 'QUIZ' },
        ],
        gradesGiven: [],
        messagesSent: [{ id: 'm-1' }],
        messagesReceived: [{ id: 'm-2' }, { id: 'm-3' }],
      } as any);

      const { analytics } = await getUserById('student-1');

      expect(analytics.totalAppointments).toBe(2);
      expect(analytics.acceptedAppointments).toBe(1);
      expect(analytics.totalGrades).toBe(2);
      expect(analytics.averageGrade).toBe(85); // (90 + 80) / 2
      expect(analytics.totalMessages).toBe(3);
      expect(analytics.teachers).toHaveLength(1);
    });
  });

  describe('updateUser', () => {
    it('throws 404 when the user is not found', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);
      await expect(updateUser('ghost', { firstName: 'X' })).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws 409 when the new email is taken by another user', async () => {
      mockedPrisma.user.findUnique
        .mockResolvedValueOnce({ id: 'user-1' } as any) // target lookup
        .mockResolvedValueOnce({ id: 'other-user' } as any); // email collision

      await expect(updateUser('user-1', { email: 'taken@test.com' })).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it('throws 400 for an invalid role value', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' } as any);
      await expect(updateUser('user-1', { role: 'SUPERADMIN' })).rejects.toMatchObject({ statusCode: 400 });
    });

    it('updates allowed fields and returns the updated user', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' } as any);
      mockedPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        firstName: 'New',
        role: 'TEACHER',
        status: 'ACTIVE',
      } as any);

      const result = await updateUser('user-1', { firstName: 'New', role: 'TEACHER' });

      expect(result.firstName).toBe('New');
      expect(mockedPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ firstName: 'New', role: 'TEACHER' }),
        })
      );
    });
  });

  describe('deleteUser (soft-delete / anonymize)', () => {
    it('throws 404 when the user is not found', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);
      await expect(deleteUser('ghost')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('anonymizes PII, bans the account, and sets deletedAt', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' } as any);
      mockedPrisma.user.update.mockResolvedValue({ id: 'user-1' } as any);

      const result = await deleteUser('user-1');

      expect(result).toEqual({ id: 'user-1', deleted: true });
      expect(mockedPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'BANNED',
            firstName: 'Deleted User',
            email: 'deleted-user-1@deleted.local',
            passwordHash: 'DELETED',
            refreshTokenHash: null,
            deviceToken: null,
            deletedAt: expect.any(Date),
          }),
        })
      );
    });
  });
});
