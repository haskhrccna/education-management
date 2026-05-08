import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '@quran-review/shared';
import * as memorizationController from '../controllers/memorization.controller';

export const surahRouter = Router();
surahRouter.use(authenticate);
surahRouter.get('/', memorizationController.listSurahs);

export const memorizationRouter = Router();
memorizationRouter.use(authenticate);
memorizationRouter.get('/', memorizationController.getProgress);
memorizationRouter.put('/:surahId', authorize(UserRole.TEACHER), memorizationController.updateProgress);
