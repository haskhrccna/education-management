import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '@quran-review/shared';
import * as parentController from '../controllers/parent.controller';

const router = Router();

router.use(authenticate);

// ─── Parent-facing endpoints ───────────────────────────────────────────────

// Request a link to a student (creates PENDING).
router.post('/links', authorize(UserRole.PARENT), parentController.requestLink);

// List links — parents see their own, admins see all.
router.get('/links', authorize(UserRole.PARENT, UserRole.ADMIN), parentController.listLinks);

// Parent's approved children.
router.get('/children', authorize(UserRole.PARENT), parentController.getChildren);

// Search a student by email (PARENT only).
router.get('/student-search', authorize(UserRole.PARENT), parentController.searchStudentByEmail);

// Read-only child dashboard (link-guarded at the service layer).
router.get('/children/:studentId/dashboard', authorize(UserRole.PARENT), parentController.getChildDashboard);

// ─── Admin-only: decide a link request ─────────────────────────────────────

router.patch('/links/:id/decision', authorize(UserRole.ADMIN), parentController.decideLink);

export default router;
