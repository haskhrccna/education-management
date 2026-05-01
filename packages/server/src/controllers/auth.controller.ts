import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma/client';
import { hashPassword, comparePassword, generateToken, generateRefreshToken, verifyRefreshToken } from '../services/auth.service';
import { AppError } from '../middleware/error.middleware';
import { sendWelcomeEmail } from '../services/email.service';

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password, role, firstName, lastName } = req.body as any;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError(409, 'Email already registered');
    }
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, passwordHash, role: role.toUpperCase(), firstName, lastName },
      select: { id: true, email: true, role: true, firstName: true, lastName: true, status: true },
    });
    
    // Send welcome email asynchronously
    sendWelcomeEmail(user.email, user.firstName).catch(() => {});
    
    res.status(201).json({ message: 'Registration successful. Awaiting admin approval.', user });
  } catch (err) {
    next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body as any;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await comparePassword(password, user.passwordHash))) {
      throw new AppError(401, 'Invalid credentials');
    }
    if (user.status !== 'ACTIVE') {
      throw new AppError(403, 'Account is not active. Please wait for admin approval.');
    }
    const token = generateToken(user.id, user.role);
    const refreshToken = generateRefreshToken();
    await prisma.user.update({ where: { id: user.id }, data: { refreshToken } });

    const userInfo = { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName, status: user.status };
    res.json({ message: 'Login successful', user: userInfo, token, refreshToken });
  } catch (err) {
    next(err);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshToken } = req.body as any;
    if (!refreshToken) throw new AppError(400, 'refreshToken is required');

    const user = await prisma.user.findFirst({ where: { refreshToken } });
    if (!user) throw new AppError(401, 'Invalid refresh token');

    const token = generateToken(user.id, user.role);
    const newRefreshToken = generateRefreshToken();
    await prisma.user.update({ where: { id: user.id }, data: { refreshToken: newRefreshToken } });

    res.json({ token, refreshToken: newRefreshToken });
  } catch (err) {
    next(err);
  }
};

export const verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await prisma.user.update({
      where: { id: req.userId! },
      data: { emailVerifiedAt: new Date() },
    });
    res.json({ message: 'Email verified', status: user.status });
  } catch (err) {
    next(err);
  }
};

export const resendVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { email: true, firstName: true } });
    if (!user) throw new AppError(404, 'User not found');
    
    await sendWelcomeEmail(user.email, user.firstName);
    res.json({ message: 'Verification email resent' });
  } catch (err) {
    next(err);
  }
};
