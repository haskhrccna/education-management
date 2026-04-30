import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { prisma } from '../prisma/client';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const REPORTS_DIR = path.join(process.cwd(), 'reports');

export const downloadRecording = async (req: Request, res: Response): Promise<void> => {
  try {
    const recordingId = String(req.params.id);
    const recording = await prisma.recording.findUnique({ where: { id: recordingId } });
    if (!recording) { res.status(404).json({ error: 'Recording not found' }); return; }

    const isOwner = recording.studentId === req.userId;
    const isTeacherOrAdmin = req.userRole === 'teacher' || req.userRole === 'admin';
    if (!isOwner && !isTeacherOrAdmin) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const fileName = recording.url.split('/').pop() || '';
    const filePath = path.join(UPLOAD_DIR, fileName);
    if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'File not found' }); return; }

    res.sendFile(filePath);
  } catch {
    res.status(500).json({ error: 'Failed to download recording' });
  }
};

export const downloadReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const reportId = String(req.params.id);
    const report = await prisma.report.findUnique({ where: { id: reportId } });
    if (!report) { res.status(404).json({ error: 'Report not found' }); return; }

    const isOwner = report.studentId === req.userId;
    const isTeacherOrAdmin = req.userRole === 'teacher' || req.userRole === 'admin';
    if (!isOwner && !isTeacherOrAdmin) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const fileName = report.pdfUrl.split('/').pop() || '';
    const filePath = path.join(REPORTS_DIR, fileName);
    if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'File not found' }); return; }

    res.sendFile(filePath);
  } catch {
    res.status(500).json({ error: 'Failed to download report' });
  }
};
