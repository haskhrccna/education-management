import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/error.middleware';
import * as halaqaService from '../services/halaqa.service';
import { successResponse } from '../lib/response';

export const createRoom = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.userRole !== 'TEACHER' && req.userRole !== 'ADMIN')
      throw new AppError(403, 'Only teachers can create rooms');
    const { title } = req.body as { title?: string };
    if (!title || !title.trim()) throw new AppError(400, 'title is required');
    const room = await halaqaService.createRoom(req.userId!, title.trim());
    res.status(201).json(successResponse(room));
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
