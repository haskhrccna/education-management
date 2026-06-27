import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/error.middleware';
import * as parentService from '../services/parent.service';

type CallerRole = 'PARENT' | 'ADMIN';

function roleOf(req: Request): CallerRole {
  const r = req.userRole as string | undefined;
  if (r === 'ADMIN') return 'ADMIN';
  // Anything else hitting these routes is a PARENT (authorize() has already
  // filtered out STUDENT/TEACHER). Keep the default for safety.
  return 'PARENT';
}

// ─── Link request / approval ────────────────────────────────────────────────

export const requestLink = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parentId = req.userId;
    if (!parentId) throw new AppError(401, 'Authentication required');
    const { studentId, reason } = req.body ?? {};
    if (!studentId || typeof studentId !== 'string') {
      throw new AppError(400, 'studentId is required');
    }
    const link = await parentService.requestLink(
      parentId,
      studentId,
      typeof reason === 'string' && reason.length > 0 ? reason : undefined
    );
    res.status(201).json({ success: true, data: link });
  } catch (err) {
    next(err);
  }
};

export const listLinks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const callerId = req.userId;
    const role = roleOf(req);
    if (!callerId) throw new AppError(401, 'Authentication required');
    const links = await parentService.listLinks(callerId, role);
    res.json({ success: true, data: links });
  } catch (err) {
    next(err);
  }
};

export const decideLink = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const adminId = req.userId;
    if (!adminId) throw new AppError(401, 'Authentication required');
    const id = String(req.params.id);
    const { action, note } = req.body ?? {};
    if (action !== 'APPROVE' && action !== 'DENY') {
      throw new AppError(400, 'action must be APPROVE or DENY');
    }
    const updated =
      action === 'APPROVE'
        ? await parentService.approveLink(id, adminId)
        : await parentService.denyLink(id, adminId, typeof note === 'string' ? note : undefined);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

// ─── Children + dashboard ────────────────────────────────────────────────────

export const getChildren = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parentId = req.userId;
    if (!parentId) throw new AppError(401, 'Authentication required');
    const children = await parentService.getChildren(parentId);
    res.json({ success: true, data: children });
  } catch (err) {
    next(err);
  }
};

export const getChildDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parentId = req.userId;
    if (!parentId) throw new AppError(401, 'Authentication required');
    const studentId = String(req.params.studentId);
    const dashboard = await parentService.getChildDashboard(parentId, studentId);
    res.json({ success: true, data: dashboard });
  } catch (err) {
    next(err);
  }
};

export const searchStudentByEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const email = String(req.query.email || '');
    const student = await parentService.findStudentByEmail(email);
    res.json({ success: true, data: student });
  } catch (err) {
    next(err);
  }
};
