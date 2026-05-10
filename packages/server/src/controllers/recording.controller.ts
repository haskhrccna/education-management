import { Request, Response, NextFunction } from 'express';
import * as recordingService from '../services/recording.service';
import { AppError } from '../middleware/error.middleware';
import { auditLog } from '../lib/audit';

export const uploadRecording = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const file = (req as any).file;
    if (!file) throw new AppError(400, 'Audio file is required');

    const { fileName, fileSizeBytes, contentType } = req.body as any;
    const actualFileName = file.originalname || fileName;
    const actualSize = file.size || fileSizeBytes || 0;
    const actualType = file.mimetype || contentType || 'audio/mpeg';

    if (!actualFileName) throw new AppError(400, 'fileName is required');
    const recording = await recordingService.uploadRecording(
      req.userId!,
      actualFileName,
      actualSize,
      actualType,
      file?.path
    );
    res.status(201).json(recording);
  } catch (err) {
    next(err);
  }
};

export const listRecordings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const recordings = await recordingService.listRecordings(req.userId!, req.userRole);
    res.json(recordings);
  } catch (err) {
    next(err);
  }
};

export const reviewRecording = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const recordingId = String(req.params.id);
    const { approved, notes } = req.body as any;
    const recording = await recordingService.reviewRecording(recordingId, req.userId!, approved, notes);
    await auditLog({
      userId: req.userId!,
      action: 'REVIEW_RECORDING',
      resourceType: 'RECORDING',
      resourceId: recordingId,
      details: { approved },
      ipAddress: req.ip,
    });
    res.json(recording);
  } catch (err) {
    next(err);
  }
};

export const deleteRecording = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const recordingId = String(req.params.id);
    const isTeacherOrAdmin = ['TEACHER', 'ADMIN'].includes(String(req.userRole));
    await recordingService.deleteRecording(recordingId, req.userId!, isTeacherOrAdmin);
    await auditLog({
      userId: req.userId!,
      action: 'DELETE_RECORDING',
      resourceType: 'RECORDING',
      resourceId: recordingId,
      ipAddress: req.ip,
    });
    res.json({ message: 'Recording deleted' });
  } catch (err) {
    next(err);
  }
};
