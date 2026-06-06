import { Router } from 'express';
import * as attendanceController from '../controllers/attendance.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// List attendance for a student (studentId required unless caller is a student
// reading their own — controller handles that fallback).
router.get('/', attendanceController.listAttendance);

export default router;
