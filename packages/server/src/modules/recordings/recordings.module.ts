import { Request } from 'express';
import multer from 'multer';
import path from 'path';
import { mediaContracts } from '@quran-review/shared';
import * as recordingService from '../../services/recording.service';
import { AppError } from '../../middleware/error.middleware';
import { paginate } from '../../middleware/pagination.middleware';
import { auditLog } from '../../lib/audit';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

// Moved verbatim from the legacy recording.routes.ts — a rejected file (bad
// mime/extension) is silently skipped by multer, surfacing as the pinned
// 400 'Audio file is required' in the handler.
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

const uploadRecording = defineRoute(
  mediaContracts.uploadRecording,
  async ({ body, userId, req }) => {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) throw new AppError(400, 'Audio file is required');

    const MAX_FILE_BYTES = 500 * 1024 * 1024; // 500 MB
    if (file.size > MAX_FILE_BYTES) throw new AppError(413, 'File too large — maximum 500 MB');

    const actualFileName = file.originalname || body.fileName;
    const actualSize = file.size || body.fileSizeBytes || 0;
    const actualType = file.mimetype || body.contentType || 'audio/mpeg';

    if (!actualFileName) throw new AppError(400, 'fileName is required');
    // validate() checks but does not write back Zod's coerced output (pinned
    // M0 behavior), so multer's string fields must be coerced here.
    const pageNum = body.page != null ? Number(body.page) : undefined;
    const surahNum = body.surahId != null ? Number(body.surahId) : undefined;
    const recording = await recordingService.uploadRecording(
      userId!,
      actualFileName,
      actualSize,
      actualType,
      file.path,
      pageNum,
      surahNum
    );
    return { status: 201 as const, body: recording };
  },
  // pre runs after authorize, before validate — same order as the legacy chain
  { pre: [upload.single('file')] }
);

const listRecordings = defineRoute(
  mediaContracts.listRecordings,
  async ({ userId, userRole }) => {
    const recordings = await recordingService.listRecordings(userId!, userRole);
    return { status: 200 as const, body: recordings };
  },
  // Legacy parsed pagination on this route (response stays unpaginated — pinned).
  { pre: [paginate(20, 100)] }
);

const reviewRecording = defineRoute(mediaContracts.reviewRecording, async ({ params, userId, req }) => {
  const recordingId = String(params.id);
  // Body deliberately unvalidated (pinned): missing `approved` ⇒ falsy ⇒ reject.
  const { approved, notes } = (req.body ?? {}) as { approved?: boolean; notes?: string };
  const recording = await recordingService.reviewRecording(recordingId, userId!, approved as boolean, notes);
  await auditLog({
    userId: userId!,
    action: 'REVIEW_RECORDING',
    resourceType: 'RECORDING',
    resourceId: recordingId,
    details: { approved },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  return { status: 200 as const, body: recording };
});

const deleteRecording = defineRoute(mediaContracts.deleteRecording, async ({ params, userId, userRole, req }) => {
  const recordingId = String(params.id);
  const isTeacherOrAdmin = ['TEACHER', 'ADMIN'].includes(String(userRole));
  await recordingService.deleteRecording(recordingId, userId!, isTeacherOrAdmin);
  await auditLog({
    userId: userId!,
    action: 'DELETE_RECORDING',
    resourceType: 'RECORDING',
    resourceId: recordingId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  return { status: 200 as const, body: { message: 'Recording deleted' as const } };
});

export const recordingsRouter = buildContractRouter(
  [uploadRecording, listRecordings, reviewRecording, deleteRecording],
  { mountPrefix: '/api/v1/recordings' }
);
