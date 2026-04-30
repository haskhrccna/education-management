import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as fileController from '../controllers/file.controller';

const router = Router();
router.use(authenticate);

router.get('/recordings/:id', fileController.downloadRecording);
router.get('/reports/:id', fileController.downloadReport);

export default router;
