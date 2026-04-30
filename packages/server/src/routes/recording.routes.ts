import { Router } from 'express';
import multer from 'multer';
import * as recordingController from '../controllers/recording.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '@edu/shared';

const upload = multer({ dest: 'uploads/' });
const router = Router();
router.use(authenticate);

// Student uploads recordings
router.post('/', authorize(UserRole.STUDENT), upload.single('file'), recordingController.uploadRecording);
router.get('/', recordingController.listRecordings);

// Teacher/Admin reviews/deletes recordings
router.put('/:id', authorize(UserRole.TEACHER, UserRole.ADMIN), recordingController.reviewRecording);
router.delete('/:id', authorize(UserRole.TEACHER, UserRole.ADMIN), recordingController.deleteRecording);

export default router;
