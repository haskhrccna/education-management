import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as gamificationController from '../controllers/gamification.controller';

const router = Router();

router.use(authenticate);

// Own streak + badges
router.get('/me', gamificationController.getMyGamification);

// Leaderboard — scope = 'all' (default) or 'teacher:<id>'
router.get('/leaderboard', gamificationController.getLeaderboard);

export default router;
