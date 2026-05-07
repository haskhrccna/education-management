import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '@quran-review/shared';
import * as exportService from '../services/export.service';
import { AppError } from '../middleware/error.middleware';

const router = Router();
router.use(authenticate);

router.get('/grades', authorize(UserRole.TEACHER, UserRole.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = req.query.studentId as string | undefined;
    const teacherId = req.query.teacherId as string | undefined;
    const csv = await exportService.exportGradesCsv(studentId, teacherId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="grades.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

router.get('/appointments', authorize(UserRole.TEACHER, UserRole.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const csv = await exportService.exportAppointmentsCsv(req.userId, req.userRole);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="appointments.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

router.get('/users', authorize(UserRole.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.query.role as string | undefined;
    const csv = await exportService.exportUsersCsv(role);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

export default router;
