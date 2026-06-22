import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

jest.mock('../email.service', () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../../prisma/client';
import {
  verifyRefreshToken,
  hashRefreshToken,
  forgotPassword,
  resetPassword,
  generateRefreshToken,
} from '../auth.service';

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('auth.service — extended coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateRefreshToken', () => {
    it('returns a 128-char hex string', () => {
      const token = generateRefreshToken();
      expect(token).toHaveLength(128);
      expect(/^[0-9a-f]+$/.test(token)).toBe(true);
    });

    it('returns a different token on each call', () => {
      expect(generateRefreshToken()).not.toBe(generateRefreshToken());
    });
  });

  describe('hashRefreshToken', () => {
    it('produces a consistent 64-char SHA-256 hex hash', () => {
      const hash = hashRefreshToken('my-token');
      expect(hash).toHaveLength(64);
      expect(hashRefreshToken('my-token')).toBe(hash);
    });

    it('produces different hashes for different inputs', () => {
      expect(hashRefreshToken('token-a')).not.toBe(hashRefreshToken('token-b'));
    });
  });

  describe('verifyRefreshToken', () => {
    it('returns true when token matches stored hash', () => {
      const token = generateRefreshToken();
      const storedHash = hashRefreshToken(token);
      expect(verifyRefreshToken(token, storedHash)).toBe(true);
    });

    it('returns false when token does not match stored hash', () => {
      const token = generateRefreshToken();
      const storedHash = hashRefreshToken('completely-different-token');
      expect(verifyRefreshToken(token, storedHash)).toBe(false);
    });

    it('returns false when storedHash is null', () => {
      expect(verifyRefreshToken('any-token', null)).toBe(false);
    });
  });

  describe('forgotPassword', () => {
    it('silently returns when email is not found (prevents user enumeration)', async () => {
      mockedPrisma.user.findFirst.mockResolvedValue(null);

      await expect(forgotPassword('ghost@test.com')).resolves.toBeUndefined();
      expect(mockedPrisma.user.update).not.toHaveBeenCalled();
    });

    it('stores a hashed reset token with 1-hour expiry when user exists', async () => {
      mockedPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'user@test.com',
        firstName: 'Ali',
      } as any);
      mockedPrisma.user.update.mockResolvedValue({ id: 'user-1' } as any);

      await forgotPassword('user@test.com');

      const call = mockedPrisma.user.update.mock.calls[0][0];
      expect(call.data.passwordResetToken).toBeDefined();
      expect(call.data.passwordResetExpiry).toBeInstanceOf(Date);
      // Expiry should be ~1 hour from now
      const diff = (call.data.passwordResetExpiry as Date).getTime() - Date.now();
      expect(diff).toBeGreaterThan(3_500_000);
      expect(diff).toBeLessThan(3_700_000);
    });

    it('fires reset email asynchronously (fire-and-forget)', async () => {
      mockedPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'user@test.com',
        firstName: 'Ali',
      } as any);
      mockedPrisma.user.update.mockResolvedValue({ id: 'user-1' } as any);

      const emailService = require('../email.service');
      await forgotPassword('user@test.com');
      // Allow the fire-and-forget promise to settle
      await new Promise((r) => setTimeout(r, 10));

      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith('user@test.com', 'Ali', expect.any(String));
    });
  });

  describe('resetPassword', () => {
    it('resets password and clears all reset/session fields', async () => {
      mockedPrisma.user.findFirst.mockResolvedValue({ id: 'user-1' } as any);
      mockedPrisma.user.update.mockResolvedValue({ id: 'user-1' } as any);

      const result = await resetPassword('valid-plain-token', 'NewPass456!');

      expect(result.message).toBe('Password reset successfully');
      expect(mockedPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            passwordResetToken: null,
            passwordResetExpiry: null,
            refreshTokenHash: null,
            passwordChangedAt: expect.any(Date),
          }),
        })
      );
    });

    it('throws AppError 400 when reset token is invalid or expired', async () => {
      mockedPrisma.user.findFirst.mockResolvedValue(null);

      await expect(resetPassword('expired-token', 'NewPass456!')).rejects.toMatchObject({
        statusCode: 400,
        message: 'Invalid or expired reset token',
      });
      expect(mockedPrisma.user.update).not.toHaveBeenCalled();
    });
  });
});
