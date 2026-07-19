import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from '../../prisma/client';
import { getPages, setPageStatus, assertCanViewStudent } from '../page-memorization.service';

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('page-memorization.service', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('setPageStatus', () => {
    it('lets a student write their own page', async () => {
      mockedPrisma.pageMemorization.upsert.mockResolvedValue({
        page: 3,
        status: 'LEARNING',
        lastReviewedAt: null,
      } as any);
      const row = await setPageStatus('u1', 'STUDENT', 3, 'LEARNING');
      expect(row.page).toBe(3);
      expect(mockedPrisma.pageMemorization.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId_page: { userId: 'u1', page: 3 } } })
      );
    });

    it('stamps lastReviewedAt when marking MEMORIZED (AC1.6)', async () => {
      mockedPrisma.pageMemorization.upsert.mockResolvedValue({
        page: 3,
        status: 'MEMORIZED',
        lastReviewedAt: new Date(),
      } as any);
      await setPageStatus('u1', 'STUDENT', 3, 'MEMORIZED');
      const arg = mockedPrisma.pageMemorization.upsert.mock.calls[0][0] as any;
      expect(arg.create.lastReviewedAt).toBeInstanceOf(Date);
      expect(arg.update.lastReviewedAt).toBeInstanceOf(Date);
    });

    it('does NOT stamp lastReviewedAt for LEARNING', async () => {
      mockedPrisma.pageMemorization.upsert.mockResolvedValue({
        page: 3,
        status: 'LEARNING',
        lastReviewedAt: null,
      } as any);
      await setPageStatus('u1', 'STUDENT', 3, 'LEARNING');
      const arg = mockedPrisma.pageMemorization.upsert.mock.calls[0][0] as any;
      expect(arg.create.lastReviewedAt).toBeNull();
      expect(arg.update.lastReviewedAt).toBeUndefined();
    });

    it('allows the assigned teacher to write for their student', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ assignedTeacherId: 't1' } as any);
      mockedPrisma.pageMemorization.upsert.mockResolvedValue({
        page: 1,
        status: 'LEARNING',
        lastReviewedAt: null,
      } as any);
      await setPageStatus('t1', 'TEACHER', 1, 'LEARNING', 's1');
      expect(mockedPrisma.pageMemorization.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId_page: { userId: 's1', page: 1 } } })
      );
    });

    it('rejects a non-assigned teacher writing for a student (403)', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ assignedTeacherId: 'someone-else' } as any);
      await expect(setPageStatus('t1', 'TEACHER', 1, 'LEARNING', 's1')).rejects.toThrow('Not allowed to update');
    });

    it('rejects a student writing for another student (403)', async () => {
      await expect(setPageStatus('u1', 'STUDENT', 1, 'LEARNING', 'other')).rejects.toThrow('Not allowed to update');
    });

    it.each([0, 605, 1.5])('rejects invalid page %p (400)', async (page) => {
      await expect(setPageStatus('u1', 'STUDENT', page as number, 'LEARNING')).rejects.toThrow('Invalid page number');
    });
  });

  describe('getPages / assertCanViewStudent', () => {
    it('returns own rows ordered by page', async () => {
      mockedPrisma.pageMemorization.findMany.mockResolvedValue([{ page: 1 }, { page: 2 }] as any);
      const rows = await getPages('u1', 'STUDENT');
      expect(rows).toHaveLength(2);
      expect(mockedPrisma.pageMemorization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u1' }, orderBy: { page: 'asc' } })
      );
    });

    it('lets an APPROVED-linked parent view the student', async () => {
      mockedPrisma.parentLink.findFirst.mockResolvedValue({ id: 'link1' } as any);
      await expect(assertCanViewStudent('p1', 'PARENT', 's1')).resolves.toBeUndefined();
    });

    it('rejects a parent without an approved link (403)', async () => {
      mockedPrisma.parentLink.findFirst.mockResolvedValue(null);
      await expect(assertCanViewStudent('p1', 'PARENT', 's1')).rejects.toThrow('Not allowed to view');
    });
  });
});
