import { Request, Response, NextFunction } from 'express';
import * as adminService from '../services/admin.service';
import { AppError } from '../middleware/error.middleware';
import { PaginatedRequest, paginatedResponse } from '../middleware/pagination.middleware';
import { successResponse } from '../lib/response';
import { auditLog } from '../lib/audit';

export const listUsers = async (req: PaginatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const roleFilter = req.query.role as string | undefined;
    const { page = 1, limit = 20, skip = 0 } = req.pagination || {};
    const { users, total } = await adminService.listUsersPaginated(roleFilter, skip, limit);
    res.json(successResponse(paginatedResponse(users, total, page, limit)));
  } catch (err) {
    next(err);
  }
};

export const createTeacher = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = req.body as { email?: string; password?: string; firstName?: string; lastName?: string };
    const { email, password, firstName, lastName } = body;
    if (!email || !password || !firstName || !lastName) {
      throw new AppError(400, 'email, password, firstName, and lastName are required');
    }
    if (password.length < 8) {
      throw new AppError(400, 'Password must be at least 8 characters');
    }
    const teacher = await adminService.createTeacher(email, password, firstName, lastName);
    await auditLog({
      userId: req.userId!,
      action: 'CREATE_TEACHER',
      resourceType: 'USER',
      resourceId: teacher.id,
      details: { email },
      ipAddress: req.ip,
    });
    res.status(201).json(successResponse(teacher));
  } catch (err) {
    next(err);
  }
};

export const approveStudent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const studentId = String(req.params.id);
    const user = await adminService.approveStudent(studentId);
    await auditLog({
      userId: req.userId!,
      action: 'APPROVE_STUDENT',
      resourceType: 'USER',
      resourceId: studentId,
      ipAddress: req.ip,
    });
    res.json(successResponse(user));
  } catch (err) {
    next(err);
  }
};

export const deactivateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = String(req.params.id);
    const user = await adminService.deactivateUser(userId);
    await auditLog({
      userId: req.userId!,
      action: 'DEACTIVATE_USER',
      resourceType: 'USER',
      resourceId: userId,
      ipAddress: req.ip,
    });
    res.json(successResponse(user));
  } catch (err) {
    next(err);
  }
};

export const getTeacherProgress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const teacherId = req.query.teacherId as string | undefined;
    const progress = await adminService.getTeacherProgress(teacherId);
    res.json(successResponse(progress));
  } catch (err) {
    next(err);
  }
};

export const getStudentProgress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const studentId = req.query.studentId as string | undefined;
    const progress = await adminService.getStudentProgress(studentId);
    res.json(successResponse(progress));
  } catch (err) {
    next(err);
  }
};

export const broadcastMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = req.body as { message?: string; targetRole?: string };
    const { message, targetRole } = body;
    if (!message) throw new AppError(400, 'message is required');
    const result = await adminService.broadcastMessage(message, targetRole);
    await auditLog({
      userId: req.userId!,
      action: 'BROADCAST',
      resourceType: 'MESSAGE',
      details: { targetRole, messageLength: message.length },
      ipAddress: req.ip,
    });
    res.json(successResponse(result));
  } catch (err) {
    next(err);
  }
};

export const bulkApprove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = req.body as { ids?: string[] };
    const { ids } = body;
    if (!Array.isArray(ids) || ids.length === 0) throw new AppError(400, 'ids array is required');
    const results = await adminService.bulkApproveStudents(ids);
    await auditLog({
      userId: req.userId!,
      action: 'BULK_APPROVE',
      resourceType: 'USER',
      details: { count: ids.length },
      ipAddress: req.ip,
    });
    res.json(successResponse(results));
  } catch (err) {
    next(err);
  }
};

export const getUserById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = String(req.params.id);
    const result = await adminService.getUserById(userId);
    res.json(successResponse(result));
  } catch (err) {
    next(err);
  }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = String(req.params.id);
    const { firstName, lastName, email, status, role } = req.body;
    const user = await adminService.updateUser(userId, { firstName, lastName, email, status, role });
    await auditLog({
      userId: req.userId!,
      action: 'UPDATE_USER',
      resourceType: 'USER',
      resourceId: userId,
      details: { firstName, lastName, email, status, role },
      ipAddress: req.ip,
    });
    res.json(successResponse(user));
  } catch (err) {
    next(err);
  }
};

export const deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = String(req.params.id);
    const result = await adminService.deleteUser(userId);
    await auditLog({
      userId: req.userId!,
      action: 'DELETE_USER',
      resourceType: 'USER',
      resourceId: userId,
      ipAddress: req.ip,
    });
    res.json(successResponse(result));
  } catch (err) {
    next(err);
  }
};

export const bulkDeactivate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = req.body as { ids?: string[] };
    const { ids } = body;
    if (!Array.isArray(ids) || ids.length === 0) throw new AppError(400, 'ids array is required');
    const results = await adminService.bulkDeactivateUsers(ids);
    await auditLog({
      userId: req.userId!,
      action: 'BULK_DEACTIVATE',
      resourceType: 'USER',
      details: { count: ids.length },
      ipAddress: req.ip,
    });
    res.json(successResponse(results));
  } catch (err) {
    next(err);
  }
};
