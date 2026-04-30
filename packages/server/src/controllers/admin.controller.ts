import { Request, Response, NextFunction } from 'express';
import * as adminService from '../services/admin.service';
import { AppError } from '../middleware/error.middleware';

export const listUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const roleFilter = req.query.role as string | undefined;
    const users = await adminService.listUsers(roleFilter);
    res.json(users);
  } catch (err) {
    next(err);
  }
};

export const createTeacher = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password, firstName, lastName } = req.body as any;
    if (!email || !password || !firstName || !lastName) {
      throw new AppError(400, 'email, password, firstName, and lastName are required');
    }
    if (password.length < 8) {
      throw new AppError(400, 'Password must be at least 8 characters');
    }
    const teacher = await adminService.createTeacher(email, password, firstName, lastName);
    res.status(201).json(teacher);
  } catch (err) {
    next(err);
  }
};

export const approveStudent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const studentId = String(req.params.id);
    const user = await adminService.approveStudent(studentId);
    res.json(user);
  } catch (err) {
    next(err);
  }
};

export const deactivateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = String(req.params.id);
    const user = await adminService.deactivateUser(userId);
    res.json(user);
  } catch (err) {
    next(err);
  }
};

export const getTeacherProgress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const teacherId = req.query.teacherId as string | undefined;
    const progress = await adminService.getTeacherProgress(teacherId);
    res.json(progress);
  } catch (err) {
    next(err);
  }
};

export const getStudentProgress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const studentId = req.query.studentId as string | undefined;
    const progress = await adminService.getStudentProgress(studentId);
    res.json(progress);
  } catch (err) {
    next(err);
  }
};

export const broadcastMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { message, targetRole }: any = req.body;
    if (!message) throw new AppError(400, 'message is required');
    const result = await adminService.broadcastMessage(message, targetRole);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
