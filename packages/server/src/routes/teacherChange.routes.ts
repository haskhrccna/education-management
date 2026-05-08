import { Router } from 'express';
import * as teacherChangeController from '../controllers/teacherChange.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { UserRole } from '@quran-review/shared';
import { SubmitTeacherChangeSchema, DecideTeacherChangeSchema } from '@quran-review/shared';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  authorize(UserRole.STUDENT),
  validate(SubmitTeacherChangeSchema),
  teacherChangeController.submitRequest
);

router.get('/', teacherChangeController.getRequests);

router.patch(
  '/:id',
  authorize(UserRole.ADMIN),
  validate(DecideTeacherChangeSchema),
  teacherChangeController.decideRequest
);

export default router;
