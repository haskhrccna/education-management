import { Request, Response, NextFunction } from 'express';
import * as gradeService from '../services/grade.service';
import { AppError } from '../middleware/error.middleware';

export const createGrade = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = req.body as any;
    if (!body.studentId || !body.subject || !body.grade || !body.type) {
      throw new AppError(400, 'studentId, subject, grade, and type are required');
    }
    const created = await gradeService.createGrade(
      req.userId!,
      body.studentId,
      body.subject,
      body.grade,
      body.type,
      body.notes
    );
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
};

export const getMyGrades = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const grades = await gradeService.getMyGrades(req.userId!);
    res.json(grades);
  } catch (err) {
    next(err);
  }
};

export const getStudentGrades = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const studentId = String(req.params.id);
    const grades = await gradeService.getStudentGrades(req.userId!, studentId);
    res.json(grades);
  } catch (err) {
    next(err);
  }
};
