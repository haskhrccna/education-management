import { Request, Response, NextFunction } from 'express';
import * as analyticsService from '../services/analytics.service';
import { successResponse } from '../lib/response';

export const getAdminAnalytics = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [surahMissRates, teacherLoad, weeklyActiveStudents] = await Promise.all([
      analyticsService.getSurahMissRates(),
      analyticsService.getTeacherLoadDistribution(),
      analyticsService.getWeeklyActiveStudents(),
    ]);
    res.json(successResponse({ surahMissRates, teacherLoad, weeklyActiveStudents }));
  } catch (err) {
    next(err);
  }
};
