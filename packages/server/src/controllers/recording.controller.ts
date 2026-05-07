import { Request, Response, NextFunction } from 'express';
import * as recordingService from '../services/recording.service';
import { AppError } from '../middleware/error.middleware';

export const uploadRecording = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const file = (req as any).file;
    const { fileName, fileSizeBytes, contentType } = req.body as any;
    const actualFileName = file?.originalname || fileName;
    const actualSize = file?.size || fileSizeBytes || 0;
    const actualType = file?.mimetype || contentType || 'audio/mpeg';

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
    res.json(recording);
  } catch (err) {
    next(err);
  }
};

export const deleteRecording = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const recordingId = String(req.params.id);
    const isTeacherOrAdmin = ['teacher', 'admin'].includes(String(req.userRole));
    await recordingService.deleteRecording(recordingId, req.userId!, isTeacherOrAdmin);
    res.json({ message: 'Recording deleted' });
  } catch (err) {
    next(err);
  }
};
