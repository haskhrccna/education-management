import { prisma } from '../prisma/client';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { AppError } from '../middleware/error.middleware';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

export const ensureUploadDir = async () => {
  try { await fs.access(UPLOAD_DIR); } catch { await fs.mkdir(UPLOAD_DIR, { recursive: true }); }
};

export const uploadRecording = async (
  studentId: string,
  fileName: string,
  fileSizeBytes: number,
  contentType: string,
  tempFilePath?: string
) => {
  await ensureUploadDir();
  const safeName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniqueName = `${crypto.randomUUID()}-${safeName}`;
  const finalPath = path.join(UPLOAD_DIR, uniqueName);

  if (tempFilePath) {
    try {
      await fs.copyFile(tempFilePath, finalPath);
      await fs.unlink(tempFilePath);
    } catch (err) {
      // Clean up temp file if final copy failed
      try { await fs.unlink(tempFilePath); } catch { /* ignore */ }
      throw new AppError(500, 'Failed to process uploaded file');
    }
  }

  return await prisma.recording.create({
    data: { studentId, url: `/uploads/${uniqueName}`, fileName: safeName, fileSizeBytes, contentType },
  });
};

export const listRecordings = async (userId: string, userRole?: string) => {
  // JWT stores lowercase role — compare lowercase to avoid case mismatch bug
  const where = userRole === 'teacher' || userRole === 'admin' ? {} : { studentId: userId };
  const recordings = await prisma.recording.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { student: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });

  return recordings;
};

export const reviewRecording = async (recordingId: string, reviewerId: string, approved: boolean, notes?: string) => {
  const recording = await prisma.recording.findUnique({ where: { id: recordingId } });
  if (!recording) throw new AppError(404, 'Recording not found');

  const updateData: Record<string, unknown> = {
    reviewedBy: reviewerId,
    reviewNotes: notes || null,
  };
  if (approved) updateData.approvedAt = new Date();
  else updateData.rejectedAt = new Date();

  return await prisma.recording.update({ where: { id: recordingId }, data: updateData });
};

export const deleteRecording = async (recordingId: string, userId: string, isTeacherOrAdmin: boolean) => {
  const recording = await prisma.recording.findUnique({ where: { id: recordingId } });
  if (!recording) throw new AppError(404, 'Recording not found');
  if (!isTeacherOrAdmin && recording.studentId !== userId) throw new AppError(403, 'Permission denied');

  const fileName = recording.url.split('/').pop() || '';
  const filePath = path.join(UPLOAD_DIR, fileName);
  try { await fs.unlink(filePath); } catch { /* already deleted */ }

  return await prisma.recording.delete({ where: { id: recordingId } });
};
