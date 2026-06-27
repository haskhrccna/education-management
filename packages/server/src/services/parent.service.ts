import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import { notifyUser } from './notification.service';

// ─── Link request / approval flow ───────────────────────────────────────────

/**
 * Parent requests a link to a student's account. Creates a PENDING link
 * which the admin must approve before the parent can read any data.
 *
 * Idempotency: a link (any status) already exists for this pair → 409.
 * The parent must ask the admin to re-issue a denied link rather than
 * silently re-creating one.
 */
export const requestLink = async (parentId: string, studentId: string, reason?: string) => {
  if (parentId === studentId) {
    throw new AppError(400, 'A parent cannot link to themselves');
  }

  const [parent, student] = await Promise.all([
    prisma.user.findUnique({ where: { id: parentId }, select: { id: true, role: true, deletedAt: true } }),
    prisma.user.findUnique({ where: { id: studentId }, select: { id: true, role: true, deletedAt: true } }),
  ]);
  if (!parent || parent.deletedAt) throw new AppError(404, 'Parent account not found');
  if (parent.role !== 'PARENT') throw new AppError(400, 'Only a parent account can request a link');
  if (!student || student.deletedAt) throw new AppError(404, 'Student not found');
  if (student.role !== 'STUDENT') throw new AppError(400, 'Link target must be a student account');

  const existing = await prisma.parentLink.findUnique({
    where: { parentId_studentId: { parentId, studentId } },
  });
  if (existing) {
    throw new AppError(409, `A link already exists for this parent/student pair (status: ${existing.status})`);
  }

  return prisma.parentLink.create({
    data: { parentId, studentId, reason: reason ?? null, status: 'PENDING' },
  });
};

/** Admin approves a pending link. Sets status, decidedAt, decidedBy. */
export const approveLink = async (linkId: string, adminId: string) => {
  const link = await prisma.parentLink.findUnique({ where: { id: linkId } });
  if (!link) throw new AppError(404, 'Link request not found');
  if (link.status === 'APPROVED') return link; // idempotent
  if (link.status === 'DENIED') {
    throw new AppError(409, 'Cannot approve a denied link — ask the parent to re-request');
  }

  const updated = await prisma.parentLink.update({
    where: { id: linkId },
    data: { status: 'APPROVED', decidedAt: new Date(), decidedBy: adminId },
  });

  // Phase-1: notify the parent of the approval
  await notifyUser({
    userId: link.parentId,
    event: 'parent_link_approved',
    data: { linkId: link.id, studentId: link.studentId },
    push: { title: 'Link approved', body: "You can now view your child's dashboard." },
  });

  return updated;
};

/** Admin denies a pending link. */
export const denyLink = async (linkId: string, adminId: string, note?: string) => {
  const link = await prisma.parentLink.findUnique({ where: { id: linkId } });
  if (!link) throw new AppError(404, 'Link request not found');
  if (link.status === 'DENIED') return link; // idempotent
  if (link.status === 'APPROVED') {
    throw new AppError(409, 'Cannot deny an approved link — admin must revoke separately');
  }

  const updated = await prisma.parentLink.update({
    where: { id: linkId },
    data: { status: 'DENIED', decidedAt: new Date(), decidedBy: adminId },
  });

  await notifyUser({
    userId: link.parentId,
    event: 'parent_link_denied',
    data: { linkId: link.id, studentId: link.studentId, note: note ?? null },
    push: {
      title: 'Link request denied',
      body: note ? `Reason: ${note}` : 'Your link request was not approved.',
    },
  });

  return updated;
};

/** List links — parents see their own, admins see all. */
export const listLinks = async (callerId: string, callerRole: 'PARENT' | 'ADMIN') => {
  if (callerRole === 'ADMIN') {
    return prisma.parentLink.findMany({
      orderBy: { requestedAt: 'desc' },
      include: {
        parent: { select: { id: true, firstName: true, lastName: true, email: true } },
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }
  return prisma.parentLink.findMany({
    where: { parentId: callerId },
    orderBy: { requestedAt: 'desc' },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
};

// ─── Children + dashboard ────────────────────────────────────────────────────

/** All approved children for a parent. */
export const getChildren = async (parentId: string) => {
  const links = await prisma.parentLink.findMany({
    where: { parentId, status: 'APPROVED' },
    orderBy: { decidedAt: 'desc' },
    include: {
      student: {
        select: { id: true, firstName: true, lastName: true, email: true, status: true },
      },
    },
  });
  return links.map((l) => ({ linkId: l.id, linkedAt: l.decidedAt, student: l.student }));
};

/**
 * Read-only dashboard for one child.
 *
 * Throws 403 unless the caller is a PARENT with an APPROVED link to the student.
 * Aggregates: profile, latest memorization (top 5), recent grades (5), recent
 * attendance (5), upcoming appointments (5), pending revisions (5).
 */
export const getChildDashboard = async (parentId: string, studentId: string) => {
  await assertParentHasApprovedLink(parentId, studentId);

  const [student, memorization, grades, attendance, upcomingAppointments, pendingRevisions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, firstName: true, lastName: true, email: true, status: true, createdAt: true },
    }),
    prisma.memorizationProgress.findMany({
      where: { userId: studentId },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      include: { surah: { select: { number: true, nameAr: true, nameEn: true, juz: true } } },
    }),
    prisma.grade.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { teacher: { select: { firstName: true, lastName: true } } },
    }),
    prisma.sessionRecord.findMany({
      where: { studentId },
      orderBy: { recordedAt: 'desc' },
      take: 5,
      include: {
        appointment: { select: { requestedDate: true, requestedTime: true } },
      },
    }),
    prisma.appointment.findMany({
      where: { studentId, status: { in: ['REQUESTED', 'ACCEPTED'] } },
      orderBy: { requestedDate: 'asc' },
      take: 5,
      include: { teacher: { select: { firstName: true, lastName: true } } },
    }),
    prisma.revisionSchedule.findMany({
      where: { userId: studentId, status: 'PENDING' },
      orderBy: { scheduledFor: 'asc' },
      take: 5,
      include: { surah: { select: { number: true, nameAr: true, nameEn: true } } },
    }),
  ]);

  if (!student) throw new AppError(404, 'Student not found');

  return {
    student,
    memorization,
    grades,
    attendance,
    upcomingAppointments,
    pendingRevisions,
  };
};

// ─── Guard ───────────────────────────────────────────────────────────────────

/**
 * The single Phase-3 invariant: a parent can read a child's data only when
 * there is an APPROVED `ParentLink` row between them. Reuses no other guard
 * — this is independent of the teacher/student accepted-appointment chain.
 */
async function assertParentHasApprovedLink(parentId: string, studentId: string) {
  const link = await prisma.parentLink.findUnique({
    where: { parentId_studentId: { parentId, studentId } },
  });
  if (!link || link.status !== 'APPROVED') {
    throw new AppError(403, 'No approved link to this student');
  }
}

export const findStudentByEmail = async (email: string) => {
  const student = await prisma.user.findFirst({
    where: { email, role: 'STUDENT', status: 'ACTIVE', deletedAt: null },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  if (!student) throw new AppError(404, 'Student not found');
  return student;
};
