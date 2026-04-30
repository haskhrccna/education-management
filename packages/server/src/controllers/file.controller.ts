import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import { uploadStorage, reportStorage } from '../lib/storage';

export const downloadRecording = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const recordingId = String(req.params.id);
    const recording = await prisma.recording.findUnique({ where: { id: recordingId } });
    if (!recording) { next(new AppError(404, 'Recording not found')); return; }

    const isOwner = recording.studentId === req.userId;
    const isTeacherOrAdmin = req.userRole === 'teacher' || req.userRole === 'admin';
    if (!isOwner && !isTeacherOrAdmin) {
      next(new AppError(403, 'Permission denied'));
      return;
    }

    const fileName = recording.url.split('/').pop() || '';
    const filePath = uploadStorage.getLocalPath(fileName);
    const exists = await uploadStorage.exists(fileName);
    if (!exists) { next(new AppError(404, 'File not found')); return; }

    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
};

export const downloadReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const reportId = String(req.params.id);
    const report = await prisma.report.findUnique({ where: { id: reportId } });
    if (!report) { next(new AppError(404, 'Report not found')); return; }

    const isOwner = report.studentId === req.userId;
    const isTeacherOrAdmin = req.userRole === 'teacher' || req.userRole === 'admin';
    if (!isOwner && !isTeacherOrAdmin) {
      next(new AppError(403, 'Permission denied'));
      return;
    }

    const fileName = report.pdfUrl.split('/').pop() || '';
    const filePath = reportStorage.getLocalPath(fileName);
    const exists = await reportStorage.exists(fileName);
    if (!exists) { next(new AppError(404, 'File not found')); return; }

    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
};
