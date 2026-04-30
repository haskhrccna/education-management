import { Router } from 'express';
import * as appointmentController from '../controllers/appointment.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '@edu/shared';

const router = Router();

// All authenticated users can view their appointments
router.use(authenticate);
router.get('/', appointmentController.getMyAppointments);

// Student routes
router.post('/', authorize(UserRole.STUDENT), appointmentController.createAppointment);

// Teacher/Admin manage appointment
router.put('/:id', authorize(UserRole.TEACHER, UserRole.ADMIN), appointmentController.manageAppointment);

export default router;
