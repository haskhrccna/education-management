import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/error.middleware';
import * as gamificationService from '../services/gamification.service';

export const getMyGamification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError(401, 'Authentication required');
    const data = await gamificationService.getMyGamification(userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getLeaderboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const scope = typeof req.query.scope === 'string' ? req.query.scope : undefined;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 20;
    const data = await gamificationService.getLeaderboard(scope, isNaN(limit) ? 20 : limit);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
