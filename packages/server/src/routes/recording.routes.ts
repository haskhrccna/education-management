import { Router } from 'express';
import multer from 'multer';
import * as recordingController from '../controllers/recording.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { paginate } from '../middleware/pagination.middleware';
import { UserRole } from '@edu/shared';
import { CreateRecordingSchema } from '@edu/shared';

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['audio/mpeg', 'audio/mp4', 'video/mp4', 'video/webm', 'audio/ogg', 'audio/wav', 'audio/x-m4a'];
    cb(null, allowed.includes(file.mimetype));
  },
});

const router = Router();
router.use(authenticate);

// Student uploads recordings
router.post('/', authorize(UserRole.STUDENT), upload.single('file'), validate(CreateRecordingSchema), recordingController.uploadRecording);
router.get('/', paginate(20, 100), recordingController.listRecordings);

// Teacher/Admin reviews/deletes recordings
router.put('/:id', authorize(UserRole.TEACHER, UserRole.ADMIN), recordingController.reviewRecording);
router.delete('/:id', authorize(UserRole.TEACHER, UserRole.ADMIN), recordingController.deleteRecording);

export default router;
