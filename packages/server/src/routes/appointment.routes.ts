import { Router } from 'express';
import * as appointmentController from '../controllers/appointment.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { UserRole } from '@edu/shared';
import { CreateAppointmentSchema, ManageAppointmentSchema } from '@edu/shared';

const router = Router();

// All authenticated users can view their appointments
router.use(authenticate);
router.get('/', appointmentController.getMyAppointments);

// Student routes
router.post('/', authorize(UserRole.STUDENT), validate(CreateAppointmentSchema), appointmentController.createAppointment);

// Teacher/Admin manage appointment
router.put('/:id', authorize(UserRole.TEACHER, UserRole.ADMIN), validate(ManageAppointmentSchema), appointmentController.manageAppointment);

export default router;
