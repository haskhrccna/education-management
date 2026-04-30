import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '@edu/shared';
import * as adminController from '../controllers/admin.controller';
const router = Router();

router.use(authenticate);
router.use(authorize(UserRole.ADMIN));

router.get('/users', adminController.listUsers);
router.post('/teachers', adminController.createTeacher);
router.put('/users/:id/approve', adminController.approveStudent);
router.put('/users/:id/deactivate', adminController.deactivateUser);
router.get('/progress/teachers', adminController.getTeacherProgress);
router.get('/progress/students', adminController.getStudentProgress);
router.post('/broadcast', adminController.broadcastMessage);

export default router;
