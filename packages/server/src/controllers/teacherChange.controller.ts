import { Request, Response, NextFunction } from 'express';
import * as teacherChangeService from '../services/teacherChange.service';

export const submitRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await teacherChangeService.submitTeacherChangeRequest(req.userId!, req.body.reason);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

export const getRequests = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const statusFilter = typeof req.query.status === 'string' ? req.query.status : undefined;
    const result = await teacherChangeService.getTeacherChangeRequests(req.userId!, req.userRole!, statusFilter);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const decideRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { action, adminNote, newTeacherId } = req.body;
    const result = await teacherChangeService.decideTeacherChangeRequest(
      String(req.params.id),
      action,
      req.userId,
      req.userRole,
      adminNote,
      newTeacherId
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};
