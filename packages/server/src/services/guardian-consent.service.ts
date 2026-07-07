import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';

/**
 * Called once a ParentLink is APPROVED. If this student has never had a
 * parent link before (status is null), open a consent request. A student
 * who already has a decision (from an earlier link) keeps it — a second
 * parent linking doesn't reset an existing GRANT/DECLINE.
 */
export const initializeConsentIfNeeded = async (studentId: string): Promise<void> => {
  const student = await prisma.user.findUnique({ where: { id: studentId }, select: { guardianConsentStatus: true } });
  if (student && student.guardianConsentStatus === null) {
    await prisma.user.update({ where: { id: studentId }, data: { guardianConsentStatus: 'PENDING' } });
  }
};

/** The parent on an APPROVED link grants or declines consent for that child. */
export const decideConsent = async (parentId: string, linkId: string, granted: boolean) => {
  const link = await prisma.parentLink.findUnique({ where: { id: linkId } });
  if (!link || link.parentId !== parentId) throw new AppError(404, 'Link not found');
  if (link.status !== 'APPROVED') {
    throw new AppError(409, 'The parent-child link must be approved before consent can be recorded');
  }

  return prisma.user.update({
    where: { id: link.studentId },
    data: {
      guardianConsentStatus: granted ? 'GRANTED' : 'DECLINED',
      guardianConsentAt: new Date(),
      guardianConsentDecidedBy: parentId,
    },
    select: { id: true, guardianConsentStatus: true, guardianConsentAt: true },
  });
};

/**
 * True if recording uploads should be blocked for this student: a parent
 * link exists (status is non-null) and consent isn't currently GRANTED.
 * A student with no parent link at all (status is null) is unaffected —
 * this never locks out students the platform has no guardian contact for.
 */
export const isRecordingBlockedByConsent = async (studentId: string): Promise<boolean> => {
  const student = await prisma.user.findUnique({ where: { id: studentId }, select: { guardianConsentStatus: true } });
  if (!student || student.guardianConsentStatus === null) return false;
  return student.guardianConsentStatus !== 'GRANTED';
};
