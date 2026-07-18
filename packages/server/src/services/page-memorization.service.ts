import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';

const TOTAL_PAGES = 604;
type Role = 'STUDENT' | 'TEACHER' | 'ADMIN' | 'PARENT';
type PageStatus = 'NOT_STARTED' | 'LEARNING' | 'MEMORIZED' | 'SOLID';

/** View guard: self, admin, the student's assigned teacher, or an APPROVED-linked parent. */
export async function assertCanViewStudent(requesterId: string, requesterRole: Role, studentId: string): Promise<void> {
  if (requesterId === studentId || requesterRole === 'ADMIN') return;
  if (requesterRole === 'TEACHER') {
    const s = await prisma.user.findUnique({ where: { id: studentId }, select: { assignedTeacherId: true } });
    if (s?.assignedTeacherId === requesterId) return;
  }
  if (requesterRole === 'PARENT') {
    const link = await prisma.parentLink.findFirst({
      where: { parentId: requesterId, studentId, status: 'APPROVED' },
    });
    if (link) return;
  }
  throw new AppError(403, 'Not allowed to view this student');
}

export async function getPages(requesterId: string, requesterRole: Role, studentId?: string) {
  const target = studentId ?? requesterId;
  await assertCanViewStudent(requesterId, requesterRole, target);
  return prisma.pageMemorization.findMany({
    where: { userId: target },
    orderBy: { page: 'asc' },
    select: { page: true, status: true, lastReviewedAt: true },
  });
}

export async function setPageStatus(
  actorId: string,
  actorRole: Role,
  page: number,
  status: PageStatus,
  studentId?: string
) {
  if (!Number.isInteger(page) || page < 1 || page > TOTAL_PAGES) throw new AppError(400, 'Invalid page number');
  const target = studentId ?? actorId;
  if (target !== actorId) {
    // Write path is tighter than view: only the assigned teacher (or admin).
    if (actorRole === 'TEACHER') {
      const s = await prisma.user.findUnique({ where: { id: target }, select: { assignedTeacherId: true } });
      if (s?.assignedTeacherId !== actorId) throw new AppError(403, 'Not allowed to update this student');
    } else if (actorRole !== 'ADMIN') {
      throw new AppError(403, 'Not allowed to update this student');
    }
  }
  // A page counts as reviewed the moment it is marked memorized/solid (AC1.6).
  const reviewedStamp = status === 'MEMORIZED' || status === 'SOLID' ? new Date() : undefined;
  return prisma.pageMemorization.upsert({
    where: { userId_page: { userId: target, page } },
    create: { userId: target, page, status, lastReviewedAt: reviewedStamp ?? null },
    update: { status, ...(reviewedStamp ? { lastReviewedAt: reviewedStamp } : {}) },
    select: { page: true, status: true, lastReviewedAt: true },
  });
}
