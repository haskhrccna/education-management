import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const generateToken = (userId: string, role: string): string => {
   // Prisma returns uppercase ('STUDENT'), JWT stores lowercase for @edu/shared UserRole compat
  const lowerRole = role.toLowerCase();
  return jwt.sign({ userId, role: lowerRole }, config.jwtSecret, { expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'] });
};

export const verifyToken = (token: string): { userId: string; role: string } | null => {
  try {
    return jwt.verify(token, config.jwtSecret) as { userId: string; role: string };
  } catch {
    return null;
  }
};
