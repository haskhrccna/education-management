import { Request, Response, NextFunction } from 'express';
import * as reportService from '../services/report.service';
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';

export const generateReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { studentId, summary } = req.body as any;
    if (!studentId) throw new AppError(400, 'studentId is required');

    // Verify teacher has an accepted appointment with this student
    const appt = await prisma.appointment.findFirst({
      where: { teacherId: req.userId!, studentId, status: 'ACCEPTED' },
      select: { id: true },
    });
    if (!appt) throw new AppError(403, 'No accepted appointment with this student');

    const pdfUrl = await reportService.generatePDFReport(req.userId!, studentId, summary || '');
    const report = await prisma.report.create({
      data: { teacherId: req.userId!, studentId, pdfUrl, generatedAt: new Date(), summary: summary || '' },
    });
    res.status(201).json(report);
  } catch (err) {
    next(err);
  }
};

export const getMyReports = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const where = req.userRole === 'STUDENT' ? { studentId: req.userId! } : { teacherId: req.userId! };
    const reports = await prisma.report.findMany({
      where,
      orderBy: { generatedAt: 'desc' },
    });
    res.json(reports);
  } catch (err) {
    next(err);
  }
};
