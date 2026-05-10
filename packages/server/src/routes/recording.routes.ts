import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import * as recordingController from '../controllers/recording.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { paginate } from '../middleware/pagination.middleware';
import { UserRole } from '@quran-review/shared';
import { CreateRecordingSchema } from '@quran-review/shared';

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'audio/mpeg',
      'audio/mp4',
      'video/mp4',
      'video/webm',
      'audio/ogg',
      'audio/wav',
      'audio/x-m4a',
    ];
    const allowedExts = ['.mp3', '.mp4', '.webm', '.ogg', '.wav', '.m4a'];
    const ext = path.extname(file.originalname).toLowerCase();
    const valid = allowedMimes.includes(file.mimetype) && allowedExts.includes(ext);
    cb(null, valid);
  },
});

const router = Router();
router.use(authenticate);

// Student uploads recordings
router.post(
  '/',
  authorize(UserRole.STUDENT),
  validate(CreateRecordingSchema),
  upload.single('file'),
  recordingController.uploadRecording
);
router.get('/', paginate(20, 100), recordingController.listRecordings);

// Teacher/Admin reviews/deletes recordings
router.put('/:id', authorize(UserRole.TEACHER, UserRole.ADMIN), recordingController.reviewRecording);
router.delete('/:id', authorize(UserRole.TEACHER, UserRole.ADMIN), recordingController.deleteRecording);

export default router;
