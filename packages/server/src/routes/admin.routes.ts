import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { paginate } from '../middleware/pagination.middleware';
import { UserRole, CreateTeacherSchema, BroadcastMessageSchema, UpdateUserSchema, BulkApproveSchema, BulkDeactivateSchema } from '@quran-review/shared';
import * as adminController from '../controllers/admin.controller';

const router = Router();

router.use(authenticate);
router.use(authorize(UserRole.ADMIN));

router.get('/users', paginate(20, 100), adminController.listUsers);
router.post('/teachers', validate(CreateTeacherSchema), adminController.createTeacher);
router.put('/users/:id/approve', adminController.approveStudent);
router.put('/users/:id/deactivate', adminController.deactivateUser);
router.get('/users/:id', adminController.getUserById);
router.put('/users/:id', validate(UpdateUserSchema), adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);
router.get('/progress/teachers', adminController.getTeacherProgress);
router.get('/progress/students', adminController.getStudentProgress);
router.post('/broadcast', validate(BroadcastMessageSchema), adminController.broadcastMessage);
router.post('/bulk/approve', validate(BulkApproveSchema), adminController.bulkApprove);
router.post('/bulk/deactivate', validate(BulkDeactivateSchema), adminController.bulkDeactivate);

export default router;
