import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { logAyahMemorizationSchema } from '@quran-review/shared';
import * as mushafController from '../controllers/mushaf.controller';

const router = Router();
router.use(authenticate);

router.get('/surahs/:id', mushafController.getSurahAyahs);
router.get('/pages/:page', mushafController.getPage);
router.post('/log-memorization', validate(logAyahMemorizationSchema), mushafController.logMemorization);

export default router;
