import jwt from 'jsonwebtoken';
import { hashPassword, comparePassword, generateToken, verifyToken } from '../auth.service';
import { config } from '../../config';

describe('auth.service', () => {
  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const hash = await hashPassword('password123');
      expect(hash).toBeDefined();
      expect(hash).not.toBe('password123');
    });
  });

  describe('comparePassword', () => {
    it('should return true for matching passwords', async () => {
      const hash = await hashPassword('password123');
      const result = await comparePassword('password123', hash);
      expect(result).toBe(true);
    });

    it('should return false for non-matching passwords', async () => {
      const hash = await hashPassword('password123');
      const result = await comparePassword('wrongpassword', hash);
      expect(result).toBe(false);
    });
  });

  describe('generateToken', () => {
    it('should encode userId and uppercase role', () => {
      const token = generateToken('user-123', 'STUDENT');
      const decoded = jwt.verify(token, config.jwtSecret) as { userId: string; role: string };
      expect(decoded.userId).toBe('user-123');
      expect(decoded.role).toBe('STUDENT');
    });

    it('should expire based on config', () => {
      const token = generateToken('user-123', 'STUDENT');
      const decoded = jwt.decode(token) as { exp: number };
      expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });
  });

  describe('verifyToken', () => {
    it('should return payload for valid token', () => {
      const token = generateToken('user-123', 'STUDENT');
      const result = verifyToken(token);
      expect(result).toMatchObject({ userId: 'user-123', role: 'STUDENT' });
      expect(result).toHaveProperty('exp');
      expect(result).toHaveProperty('iat');
    });

    it('should return null for invalid token', () => {
      const result = verifyToken('invalid-token');
      expect(result).toBeNull();
    });
  });
});
