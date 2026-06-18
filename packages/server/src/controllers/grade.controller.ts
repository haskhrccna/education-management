import { Request, Response, NextFunction } from 'express';
import * as gradeService from '../services/grade.service';
import { auditLog } from '../lib/audit';

export const createGrade = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { studentId, surahId, grade, type, notes } = req.body;
    const created = await gradeService.createGrade(req.userId!, studentId, surahId, grade, type, notes);
    await auditLog({
      userId: req.userId!,
      action: 'CREATE_GRADE',
      resourceType: 'GRADE',
      resourceId: created.id,
      details: { studentId, surahId, type },
      ipAddress: req.ip,
    });
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
