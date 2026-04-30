import { Router } from 'express';
import * as reportController from '../controllers/report.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { UserRole } from '@edu/shared';
import { GenerateReportSchema } from '@edu/shared';

const router = Router();
router.use(authenticate);

// Teacher generates reports for students
router.post('/', authorize(UserRole.TEACHER), validate(GenerateReportSchema), reportController.generateReport);
router.get('/', authorize(UserRole.TEACHER, UserRole.ADMIN), reportController.getMyReports);

export default router;
