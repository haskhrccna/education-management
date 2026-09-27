import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from '../../prisma/client';
import { initializeConsentIfNeeded, decideConsent, isRecordingBlockedByConsent } from '../guardian-consent.service';

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('guardian-consent.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initializeConsentIfNeeded', () => {
    it('opens a PENDING consent request for a student with no prior status', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ guardianConsentStatus: null } as any);

      await initializeConsentIfNeeded('student-1');

      expect(mockedPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'student-1' },
        data: { guardianConsentStatus: 'PENDING' },
      });
    });

    it('does not reset an existing decision from an earlier parent link', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ guardianConsentStatus: 'GRANTED' } as any);

      await initializeConsentIfNeeded('student-1');

      expect(mockedPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('decideConsent', () => {
    it('throws 404 when the link does not belong to this parent', async () => {
      mockedPrisma.parentLink.findUnique.mockResolvedValue({
        id: 'link-1',
        parentId: 'someone-else',
        status: 'APPROVED',
        studentId: 'student-1',
      } as any);

      await expect(decideConsent('parent-1', 'link-1', true)).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws 409 when the link is not yet APPROVED', async () => {
      mockedPrisma.parentLink.findUnique.mockResolvedValue({
        id: 'link-1',
        parentId: 'parent-1',
        status: 'PENDING',
        studentId: 'student-1',
      } as any);

      await expect(decideConsent('parent-1', 'link-1', true)).rejects.toMatchObject({ statusCode: 409 });
    });

    it('records GRANTED with the deciding parent when granted is true', async () => {
      mockedPrisma.parentLink.findUnique.mockResolvedValue({
        id: 'link-1',
        parentId: 'parent-1',
        status: 'APPROVED',
        studentId: 'student-1',
      } as any);
      mockedPrisma.user.update.mockResolvedValue({ id: 'student-1', guardianConsentStatus: 'GRANTED' } as any);

      await decideConsent('parent-1', 'link-1', true);

      expect(mockedPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'student-1' },
          data: expect.objectContaining({ guardianConsentStatus: 'GRANTED', guardianConsentDecidedBy: 'parent-1' }),
        })
      );
    });

    it('records DECLINED when granted is false', async () => {
      mockedPrisma.parentLink.findUnique.mockResolvedValue({
        id: 'link-1',
        parentId: 'parent-1',
        status: 'APPROVED',
        studentId: 'student-1',
      } as any);
      mockedPrisma.user.update.mockResolvedValue({ id: 'student-1', guardianConsentStatus: 'DECLINED' } as any);

      await decideConsent('parent-1', 'link-1', false);

      expect(mockedPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ guardianConsentStatus: 'DECLINED' }) })
      );
    });
  });

  describe('isRecordingBlockedByConsent', () => {
    it('is false for a student with no parent link at all (status null)', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ guardianConsentStatus: null } as any);

      expect(await isRecordingBlockedByConsent('student-1')).toBe(false);
    });

    it('is false once consent is GRANTED', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ guardianConsentStatus: 'GRANTED' } as any);

      expect(await isRecordingBlockedByConsent('student-1')).toBe(false);
    });

    it('is true while consent is PENDING', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ guardianConsentStatus: 'PENDING' } as any);

      expect(await isRecordingBlockedByConsent('student-1')).toBe(true);
    });

    it('is true when consent was DECLINED', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ guardianConsentStatus: 'DECLINED' } as any);

      expect(await isRecordingBlockedByConsent('student-1')).toBe(true);
    });
  });
});
