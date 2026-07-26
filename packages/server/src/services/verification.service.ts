import { randomUUID } from 'crypto';
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import { shareImageStorage } from '../lib/storage';

export const PROGRAM_NAME = 'Quran Review';

export type VerificationResult =
  | {
      type: 'CERTIFICATE';
      studentName: string;
      programName: string;
      issuedAt: Date;
    }
  | {
      type: 'IJAZAH';
      studentName: string;
      teacherName: string;
      programName: string;
      scope: 'SURAH' | 'JUZ' | 'FULL_QURAN';
      surahNameEn: string | null;
      surahNameAr: string | null;
      juzNumber: number | null;
      issuedAt: Date;
    };

/**
 * Public lookup by the unguessable token — no auth, no studentId in the
 * URL. Returns null for an unknown OR revoked (active:false) token, so a
 * revoked link 404s exactly like one that never existed.
 */
export const verifyToken = async (token: string): Promise<VerificationResult | null> => {
  const cert = await prisma.certificate.findUnique({
    where: { verificationToken: token },
    select: { active: true, issuedAt: true, student: { select: { firstName: true, lastName: true } } },
  });
  if (cert) {
    if (!cert.active) return null;
    return {
      type: 'CERTIFICATE',
      studentName: `${cert.student.firstName} ${cert.student.lastName}`,
      programName: PROGRAM_NAME,
      issuedAt: cert.issuedAt,
    };
  }

  const ijazah = await prisma.ijazah.findUnique({
    where: { verificationToken: token },
    select: {
      active: true,
      scope: true,
      juzNumber: true,
      issuedAt: true,
      student: { select: { firstName: true, lastName: true } },
      teacher: { select: { firstName: true, lastName: true } },
      surah: { select: { nameEn: true, nameAr: true } },
    },
  });
  if (ijazah) {
    if (!ijazah.active) return null;
    return {
      type: 'IJAZAH',
      studentName: `${ijazah.student.firstName} ${ijazah.student.lastName}`,
      teacherName: `${ijazah.teacher.firstName} ${ijazah.teacher.lastName}`,
      programName: PROGRAM_NAME,
      scope: ijazah.scope,
      surahNameEn: ijazah.surah?.nameEn ?? null,
      surahNameAr: ijazah.surah?.nameAr ?? null,
      juzNumber: ijazah.juzNumber,
      issuedAt: ijazah.issuedAt,
    };
  }

  return null;
};

/** Regenerating IS the revoke — the old token stops resolving the instant the new one replaces it. */
export const regenerateCertificateLink = async (certId: string, studentId: string) => {
  const cert = await prisma.certificate.findUnique({
    where: { id: certId },
    select: { studentId: true, verificationToken: true },
  });
  if (!cert || cert.studentId !== studentId) throw new AppError(404, 'Certificate not found');
  const updated = await prisma.certificate.update({
    where: { id: certId },
    data: { verificationToken: randomUUID(), active: true },
  });
  // Best-effort: the endpoint already 404s on the old token regardless of
  // cache state (AC8.3) — this just stops a rendered PNG containing the
  // student's name from sitting on disk indefinitely after rotation.
  const oldToken = cert.verificationToken;
  await shareImageStorage.delete(`${oldToken}.png`).catch(() => {});
  return updated;
};

export const regenerateIjazahLink = async (ijazahId: string, studentId: string) => {
  const ijazah = await prisma.ijazah.findUnique({
    where: { id: ijazahId },
    select: { studentId: true, verificationToken: true },
  });
  if (!ijazah || ijazah.studentId !== studentId) throw new AppError(404, 'Ijazah not found');
  const updated = await prisma.ijazah.update({
    where: { id: ijazahId },
    data: { verificationToken: randomUUID(), active: true },
  });
  const oldToken = ijazah.verificationToken;
  await shareImageStorage.delete(`${oldToken}.png`).catch(() => {});
  return updated;
};
