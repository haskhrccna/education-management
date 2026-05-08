import { Request, Response, NextFunction } from 'express';
import * as gradeService from '../services/grade.service';

export const createGrade = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { studentId, subject, grade, type, notes } = req.body;
    const created = await gradeService.createGrade(req.userId!, studentId, subject, grade, type, notes);
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
    const grades = await gradeService.getStudentGrades(req.userId!, req.userRole!, studentId);
    res.json(grades);
  } catch (err) {
    next(err);
  }
};
