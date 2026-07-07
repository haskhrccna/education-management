import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/error.middleware';
import * as halaqaService from '../services/halaqa.service';
import { successResponse } from '../lib/response';

export const createRoom = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.userRole !== 'TEACHER' && req.userRole !== 'ADMIN')
      throw new AppError(403, 'Only teachers can create rooms');
    const { title, groupId } = req.body as { title?: string; groupId?: string };
    if (!title || !title.trim()) throw new AppError(400, 'title is required');
    const room = await halaqaService.createRoom(req.userId!, title.trim(), groupId);
    res.status(201).json(successResponse(room));
  } catch (err) {
    next(err);
  }
};

export const createGroup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.userRole !== 'TEACHER' && req.userRole !== 'ADMIN')
      throw new AppError(403, 'Only teachers can create halaqa groups');
    const { title, attendanceThreshold } = req.body as { title?: string; attendanceThreshold?: number };
    if (!title || !title.trim()) throw new AppError(400, 'title is required');
    if (typeof attendanceThreshold !== 'number') throw new AppError(400, 'attendanceThreshold is required');
    const group = await halaqaService.createGroup(req.userId!, title.trim(), attendanceThreshold);
    res.status(201).json(successResponse(group));
  } catch (err) {
    next(err);
  }
};

export const listGroups = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const groups = await halaqaService.listGroups(req.userId!);
    res.json(successResponse(groups));
  } catch (err) {
    next(err);
  }
};

export const getGroup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const group = await halaqaService.getGroup(String(req.params.id), req.userId!, req.userRole!);
    res.json(successResponse(group));
  } catch (err) {
    next(err);
  }
};

export const listRooms = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const rooms = await halaqaService.listRooms(status);
    res.json(successResponse(rooms));
  } catch (err) {
    next(err);
  }
};

export const getRoom = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const room = await halaqaService.getRoom(String(req.params.id));
    res.json(successResponse(room));
  } catch (err) {
    next(err);
  }
};

export const startRoom = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const room = await halaqaService.startRoom(String(req.params.id), req.userId!);
    res.json(successResponse(room));
  } catch (err) {
    next(err);
  }
};

export const endRoom = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const room = await halaqaService.endRoom(String(req.params.id), req.userId!, req.userRole!);
    res.json(successResponse(room));
  } catch (err) {
    next(err);
  }
};
