import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

jest.mock('../../lib/storage', () => ({
  shareImageStorage: { delete: jest.fn().mockResolvedValue(undefined) },
}));

import { prisma } from '../../prisma/client';
import { verifyToken, regenerateCertificateLink, regenerateIjazahLink } from '../verification.service';
import { shareImageStorage } from '../../lib/storage';

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('verification.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyToken', () => {
    it('returns a CERTIFICATE result for an active certificate token', async () => {
      mockedPrisma.certificate.findUnique.mockResolvedValue({
        active: true,
        issuedAt: new Date('2026-01-01'),
        student: { firstName: 'Ali', lastName: 'Ahmad' },
      } as any);

      const result = await verifyToken('tok-cert');

      expect(result).toMatchObject({ type: 'CERTIFICATE', studentName: 'Ali Ahmad' });
    });

    it('returns null for a revoked (inactive) certificate token', async () => {
      mockedPrisma.certificate.findUnique.mockResolvedValue({ active: false } as any);

      expect(await verifyToken('tok-revoked')).toBeNull();
    });

    it('returns an IJAZAH result when no certificate matches but an ijazah does', async () => {
      mockedPrisma.certificate.findUnique.mockResolvedValue(null);
      mockedPrisma.ijazah.findUnique.mockResolvedValue({
        active: true,
        scope: 'FULL_QURAN',
        juzNumber: null,
        issuedAt: new Date('2026-01-01'),
        student: { firstName: 'Ali', lastName: 'Ahmad' },
        teacher: { firstName: 'Ahmad', lastName: 'Al-Rashid' },
        surah: null,
      } as any);

      const result = await verifyToken('tok-ijazah');

      expect(result).toMatchObject({ type: 'IJAZAH', studentName: 'Ali Ahmad', teacherName: 'Ahmad Al-Rashid' });
    });

    it('returns null (not an error) for an unknown token — a 404, not a leak of which tokens exist', async () => {
      mockedPrisma.certificate.findUnique.mockResolvedValue(null);
      mockedPrisma.ijazah.findUnique.mockResolvedValue(null);

      expect(await verifyToken('tok-unknown')).toBeNull();
    });
  });

  describe('regenerateCertificateLink', () => {
    it('throws 404 when the certificate belongs to a different student', async () => {
      mockedPrisma.certificate.findUnique.mockResolvedValue({
        studentId: 'someone-else',
        verificationToken: 'old-token',
      } as any);

      await expect(regenerateCertificateLink('cert-1', 'student-1')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('rotates the token, reactivates the link, and best-effort deletes the old share image', async () => {
      mockedPrisma.certificate.findUnique.mockResolvedValue({
        studentId: 'student-1',
        verificationToken: 'old-token',
      } as any);
      mockedPrisma.certificate.update.mockResolvedValue({ id: 'cert-1', active: true } as any);

      await regenerateCertificateLink('cert-1', 'student-1');

      expect(mockedPrisma.certificate.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'cert-1' }, data: expect.objectContaining({ active: true }) })
      );
      expect(shareImageStorage.delete).toHaveBeenCalledWith('old-token.png');
    });
  });

  describe('regenerateIjazahLink', () => {
    it('throws 404 when the ijazah belongs to a different student', async () => {
      mockedPrisma.ijazah.findUnique.mockResolvedValue({
        studentId: 'someone-else',
        verificationToken: 'old-token',
      } as any);

      await expect(regenerateIjazahLink('ijazah-1', 'student-1')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('rotates the token and best-effort deletes the old share image', async () => {
      mockedPrisma.ijazah.findUnique.mockResolvedValue({
        studentId: 'student-1',
        verificationToken: 'old-token',
      } as any);
      mockedPrisma.ijazah.update.mockResolvedValue({ id: 'ijazah-1', active: true } as any);

      await regenerateIjazahLink('ijazah-1', 'student-1');

      expect(shareImageStorage.delete).toHaveBeenCalledWith('old-token.png');
    });
  });
});
