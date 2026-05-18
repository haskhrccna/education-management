import { Router } from 'express';
import * as reportController from '../controllers/report.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { UserRole } from '@quran-review/shared';
import { GenerateReportSchema } from '@quran-review/shared';

const router = Router();
router.use(authenticate);

// Teacher generates reports for students
router.post('/', authorize(UserRole.TEACHER), validate(GenerateReportSchema), reportController.generateReport);
router.get('/', authorize(UserRole.TEACHER, UserRole.ADMIN, UserRole.STUDENT), reportController.getMyReports);

export default router;
