import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import { uploadStorage, reportStorage, certificateStorage } from '../lib/storage';

export interface ResolvedDownload {
  filePath: string;
  fileName: string;
}

async function assertTeacherStudentRelationship(teacherId: string, studentId: string) {
  const appt = await prisma.appointment.findFirst({
    where: { teacherId, studentId, status: 'ACCEPTED' },
    select: { id: true },
  });
  if (!appt) throw new AppError(403, 'No accepted appointment with this student');
}

/** Owner / admin / relationship-guarded teacher — moved verbatim from file.controller. */
export const resolveRecordingDownload = async (
  userId: string,
  userRole: string | undefined,
  recordingId: string
): Promise<ResolvedDownload> => {
  const recording = await prisma.recording.findUnique({ where: { id: recordingId } });
  if (!recording) throw new AppError(404, 'Recording not found');

  const isOwner = recording.studentId === userId;
  const isAdmin = userRole === 'ADMIN';
  const isTeacher = userRole === 'TEACHER';
  if (!isOwner && !isAdmin && !isTeacher) throw new AppError(403, 'Permission denied');
  if (isTeacher) await assertTeacherStudentRelationship(userId, recording.studentId);

  const fileName = recording.url.split('/').pop() || '';
  const exists = await uploadStorage.exists(fileName);
  if (!exists) throw new AppError(404, 'File not found');

  return { filePath: uploadStorage.getLocalPath(fileName), fileName };
};

export const resolveReportDownload = async (
  userId: string,
  userRole: string | undefined,
  reportId: string
): Promise<ResolvedDownload> => {
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) throw new AppError(404, 'Report not found');

  const isOwner = report.studentId === userId;
  const isAdmin = userRole === 'ADMIN';
  const isTeacher = userRole === 'TEACHER';
  if (!isOwner && !isAdmin && !isTeacher) throw new AppError(403, 'Permission denied');
  if (isTeacher) await assertTeacherStudentRelationship(userId, report.studentId);

  const fileName = report.pdfUrl.split('/').pop() || '';
  const exists = await reportStorage.exists(fileName);
  if (!exists) throw new AppError(404, 'File not found');

  return { filePath: reportStorage.getLocalPath(fileName), fileName };
};

/** Certificates: owner or admin only — teachers have no download path (pinned). */
export const resolveCertificateDownload = async (
  userId: string,
  userRole: string | undefined,
  certId: string
): Promise<ResolvedDownload> => {
  const cert = await prisma.certificate.findUnique({ where: { id: certId } });
  if (!cert) throw new AppError(404, 'Certificate not found');

  const isOwner = cert.studentId === userId;
  const isAdmin = userRole === 'ADMIN';
  if (!isOwner && !isAdmin) throw new AppError(403, 'Permission denied');

  const fileName = cert.pdfUrl.split('/').pop() || '';
  const exists = await certificateStorage.exists(fileName);
  if (!exists) throw new AppError(404, 'File not found');

  return { filePath: certificateStorage.getLocalPath(fileName), fileName };
};
