import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/error.middleware';
import { successResponse } from '../lib/response';
import * as mushafService from '../services/mushaf.service';

export const getSurahAyahs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const surahId = parseInt(req.params.id, 10);
    if (isNaN(surahId)) throw new AppError(400, 'Invalid surah id');
    const data = await mushafService.getSurahWithAyahs(surahId);
    res.json(successResponse(data));
  } catch (err) {
    next(err);
  }
};

export const getPage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.params.page, 10);
    if (isNaN(page)) throw new AppError(400, 'Invalid page number');
    const data = await mushafService.getPage(page);
    res.json(successResponse(data));
  } catch (err) {
    next(err);
  }
};

export const logMemorization = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId!;
    const { surahId, ayahNumber, memorized } = req.body as { surahId: number; ayahNumber: number; memorized: boolean };
    const data = await mushafService.logAyahMemorization(userId, surahId, ayahNumber, memorized);
    res.json(successResponse(data));
  } catch (err) {
    next(err);
  }
};
