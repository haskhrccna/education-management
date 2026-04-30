import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma/client';
import { hashPassword, comparePassword, generateToken } from '../services/auth.service';
import { AppError } from '../middleware/error.middleware';

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
    const { sendWelcomeEmail } = await import('../services/email.service');
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
    const userInfo = { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName, status: user.status };
    res.json({ message: 'Login successful', user: userInfo, token });
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
    
    const { sendWelcomeEmail } = await import('../services/email.service');
    await sendWelcomeEmail(user.email, user.firstName);
    res.json({ message: 'Verification email resent' });
  } catch (err) {
    next(err);
  }
};
