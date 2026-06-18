import { Router } from 'express';
import * as appointmentController from '../controllers/appointment.controller';
import * as attendanceController from '../controllers/attendance.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { UserRole } from '@quran-review/shared';
import { CreateAppointmentSchema, ManageAppointmentSchema } from '@quran-review/shared';

const router = Router();

// All authenticated users can view their appointments
router.use(authenticate);
router.get('/', appointmentController.getMyAppointments);

// Student routes
router.post(
  '/',
  authorize(UserRole.STUDENT),
  validate(CreateAppointmentSchema),
  appointmentController.createAppointment
);

// Teacher/Admin manage appointment
router.put(
  '/:id',
  authorize(UserRole.TEACHER, UserRole.ADMIN),
  validate(ManageAppointmentSchema),
  appointmentController.manageAppointment
);

// Teacher records attendance for one of their appointments
router.post('/:id/attendance', authorize(UserRole.TEACHER), attendanceController.recordAttendance);

export default router;
