import { Request, Response, NextFunction } from 'express';
import * as memorizationService from '../services/memorization.service';
import { AppError } from '../middleware/error.middleware';

export const listSurahs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const surahs = await memorizationService.getSurahs();
    res.json(surahs);
  } catch (err) {
    next(err);
  }
};

export const getProgress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const studentId = req.query.studentId as string | undefined;
    const progress = await memorizationService.getProgress(req.userId!, req.userRole!, studentId);
    res.json(progress);
  } catch (err) {
    next(err);
  }
};

export const updateProgress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const surahId = parseInt(req.params.surahId as string, 10);
    if (isNaN(surahId)) throw new AppError(400, 'Invalid surahId');
    const { studentId, memorizedAyahs, status } = req.body;
    if (!studentId) throw new AppError(400, 'studentId is required');
    if (typeof memorizedAyahs !== 'number') throw new AppError(400, 'memorizedAyahs must be a number');
    const result = await memorizationService.updateProgress(
      req.userId!, surahId, studentId as string, memorizedAyahs, status
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};
