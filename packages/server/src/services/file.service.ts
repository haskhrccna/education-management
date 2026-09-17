import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import { uploadStorage, reportStorage, certificateStorage } from '../lib/storage';
import { assertParentHasApprovedLink } from './parent.service';

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
  const isParent = userRole === 'PARENT';
  if (isParent) {
    await assertParentHasApprovedLink(userId, recording.studentId); // throws 403 if not linked
  } else if (!isOwner && !isAdmin && !isTeacher) {
    throw new AppError(403, 'Permission denied');
  }
  if (isTeacher) await assertTeacherStudentRelationship(userId, recording.studentId);

  const fileName = recording.url.split('/').pop() || '';
  const exists = await uploadStorage.exists(fileName);
  if (!exists) throw new AppError(404, 'File not found');

  return { filePath: uploadStorage.getLocalPath(fileName), fileName };
};

/**
 * S3 flow counterpart: when the Recording row carries a raw object key
 * (created via POST /files/complete), stream it from S3-compatible storage
 * instead of local disk. Returns null when the row is a legacy local-disk
 * recording — callers fall back to resolveRecordingDownload above.
 */
export const resolveRecordingStorageBlob = async (
  userId: string,
  userRole: string | undefined,
  recordingId: string
): Promise<{ storageKey: string; fileName: string } | null> => {
  const recording = await prisma.recording.findUnique({ where: { id: recordingId } });
  if (!recording) throw new AppError(404, 'Recording not found');

  const isOwner = recording.studentId === userId;
  const isAdmin = userRole === 'ADMIN';
  const isTeacher = userRole === 'TEACHER';
  const isParent = userRole === 'PARENT';
  if (isParent) {
    await assertParentHasApprovedLink(userId, recording.studentId);
  } else if (!isOwner && !isAdmin && !isTeacher) {
    throw new AppError(403, 'Permission denied');
  }
  if (isTeacher) await assertTeacherStudentRelationship(userId, recording.studentId);

  if (!isLikelyS3Url(recording.url)) return null;
  const fileName = recording.fileName || recording.url.split('/').pop() || 'recording';
  return { storageKey: s3UrlToKey(recording.url), fileName };
};

/** A URL counts as S3-stored when it is (a) a raw object key from the
 *  presign flow — always produced as 'recordings/<userId>/<uuid>-<name>' —
 *  or (b) an absolute http(s) CDN URL. Legacy local-disk rows use
 *  '/uploads/...' or the older relative 'uploads/...' shape and must fall
 *  through to the disk path. Do NOT treat every slash-less string as S3:
 *  legacy relative paths also lack a leading slash. */
export const isLikelyS3Url = (url: string): boolean => /^https?:\/\//.test(url) || url.startsWith('recordings/');

/** Same discriminator for server-generated PDFs. A report/certificate row
 *  written while object storage was configured stores the raw object key
 *  ('reports/<file>.pdf'); every legacy row stores an absolute-looking local
 *  path ('/reports/<file>.pdf'), so the leading slash is the tell. */
export const isObjectStoragePdfUrl = (url: string, prefix: 'reports' | 'certificates'): boolean =>
  /^https?:\/\//.test(url) || url.startsWith(`${prefix}/`);

/** Strip the scheme/host and leading /<bucket>/ from a storage URL, leaving
 *  the raw object key. Raw keys pass through unchanged. */
export const s3UrlToKey = (url: string): string => {
  if (!/^https?:\/\//.test(url)) return url.replace(/^\/+/, '');
  const path = url.replace(/^https?:\/\/[^/]+/, '');
  const bucket = process.env.STORAGE_BUCKET || 'quran-review-media';
  return path.replace(new RegExp(`^/${bucket}/`), '').replace(/^\/+/, '');
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
  const isParent = userRole === 'PARENT';
  if (isParent) {
    await assertParentHasApprovedLink(userId, report.studentId); // throws 403 if not linked
  } else if (!isOwner && !isAdmin && !isTeacher) {
    throw new AppError(403, 'Permission denied');
  }
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

/**
 * Object-storage counterparts of the two resolvers above. Authorization is
 * identical — these run the SAME checks before revealing anything — and they
 * return null for legacy local-disk rows so the caller falls back to disk.
 */
export const resolveReportStorageBlob = async (
  userId: string,
  userRole: string | undefined,
  reportId: string
): Promise<{ storageKey: string; fileName: string } | null> => {
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) throw new AppError(404, 'Report not found');

  const isOwner = report.studentId === userId;
  const isAdmin = userRole === 'ADMIN';
  const isTeacher = userRole === 'TEACHER';
  const isParent = userRole === 'PARENT';
  if (isParent) {
    await assertParentHasApprovedLink(userId, report.studentId);
  } else if (!isOwner && !isAdmin && !isTeacher) {
    throw new AppError(403, 'Permission denied');
  }
  if (isTeacher) await assertTeacherStudentRelationship(userId, report.studentId);

  if (!isObjectStoragePdfUrl(report.pdfUrl, 'reports')) return null;
  return { storageKey: s3UrlToKey(report.pdfUrl), fileName: report.pdfUrl.split('/').pop() || 'report.pdf' };
};

export const resolveCertificateStorageBlob = async (
  userId: string,
  userRole: string | undefined,
  certId: string
): Promise<{ storageKey: string; fileName: string } | null> => {
  const cert = await prisma.certificate.findUnique({ where: { id: certId } });
  if (!cert) throw new AppError(404, 'Certificate not found');

  const isOwner = cert.studentId === userId;
  const isAdmin = userRole === 'ADMIN';
  if (!isOwner && !isAdmin) throw new AppError(403, 'Permission denied');

  if (!isObjectStoragePdfUrl(cert.pdfUrl, 'certificates')) return null;
  return { storageKey: s3UrlToKey(cert.pdfUrl), fileName: cert.pdfUrl.split('/').pop() || 'certificate.pdf' };
};
