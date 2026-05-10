import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import { uploadStorage, reportStorage } from '../lib/storage';

async function assertTeacherStudentRelationship(teacherId: string, studentId: string) {
  const appt = await prisma.appointment.findFirst({
    where: { teacherId, studentId, status: 'ACCEPTED' },
    select: { id: true },
  });
  if (!appt) throw new AppError(403, 'No accepted appointment with this student');
}

export const downloadRecording = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const recordingId = String(req.params.id);
    const recording = await prisma.recording.findUnique({ where: { id: recordingId } });
    if (!recording) {
      next(new AppError(404, 'Recording not found'));
      return;
    }

    const isOwner = recording.studentId === req.userId;
    const isAdmin = req.userRole === 'ADMIN';
    const isTeacher = req.userRole === 'TEACHER';
    if (!isOwner && !isAdmin && !isTeacher) {
      next(new AppError(403, 'Permission denied'));
      return;
    }
    if (isTeacher) {
      await assertTeacherStudentRelationship(req.userId!, recording.studentId);
    }

    const fileName = recording.url.split('/').pop() || '';
    const filePath = uploadStorage.getLocalPath(fileName);
    const exists = await uploadStorage.exists(fileName);
    if (!exists) {
      next(new AppError(404, 'File not found'));
      return;
    }

    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
};

export const downloadReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const reportId = String(req.params.id);
    const report = await prisma.report.findUnique({ where: { id: reportId } });
    if (!report) {
      next(new AppError(404, 'Report not found'));
      return;
    }

    const isOwner = report.studentId === req.userId;
    const isAdmin = req.userRole === 'ADMIN';
    const isTeacher = req.userRole === 'TEACHER';
    if (!isOwner && !isAdmin && !isTeacher) {
      next(new AppError(403, 'Permission denied'));
      return;
    }
    if (isTeacher) {
      await assertTeacherStudentRelationship(req.userId!, report.studentId);
    }

    const fileName = report.pdfUrl.split('/').pop() || '';
    const filePath = reportStorage.getLocalPath(fileName);
    const exists = await reportStorage.exists(fileName);
    if (!exists) {
      next(new AppError(404, 'File not found'));
      return;
    }

    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
};
