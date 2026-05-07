import { Router } from 'express';
import * as gradeController from '../controllers/grade.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { UserRole } from '@quran-review/shared';
import { CreateGradeSchema } from '@quran-review/shared';

const router = Router();

router.use(authenticate);
router.get('/', gradeController.getMyGrades); // Student: view own grades
router.post('/', authorize(UserRole.TEACHER), validate(CreateGradeSchema), gradeController.createGrade); // Teacher: create grade
router.get('/student/:id', authorize(UserRole.TEACHER, UserRole.ADMIN), gradeController.getStudentGrades);

export default router;
