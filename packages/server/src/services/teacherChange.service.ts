import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';

export const submitTeacherChangeRequest = async (studentId: string, reason: string) => {
  const appointment = await prisma.appointment.findFirst({
    where: { studentId, status: 'ACCEPTED' },
    select: { teacherId: true },
  });

  const existing = await prisma.teacherChangeRequest.findFirst({
    where: { studentId, status: 'PENDING' },
    select: { id: true },
  });
  if (existing) throw new AppError(409, 'You already have a pending request');

  return await prisma.teacherChangeRequest.create({
    data: {
      studentId,
      currentTeacherId: appointment?.teacherId ?? null,
      reason,
      status: 'PENDING',
    },
    include: {
      currentTeacher: { select: { id: true, firstName: true, lastName: true } },
    },
  });
};

export const getTeacherChangeRequests = async (userId: string, userRole: string, statusFilter?: string) => {
  if (userRole === 'STUDENT') {
    return await prisma.teacherChangeRequest.findMany({
      where: { studentId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        currentTeacher: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  if (userRole === 'TEACHER') {
    return await prisma.teacherChangeRequest.findMany({
      where: { currentTeacherId: userId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  // ADMIN
  const where = statusFilter ? { status: statusFilter as 'PENDING' | 'APPROVED' | 'DENIED' } : {};
  return await prisma.teacherChangeRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, email: true } },
      currentTeacher: { select: { id: true, firstName: true, lastName: true } },
    },
  });
};

export const decideTeacherChangeRequest = async (
  id: string,
  action: 'APPROVE' | 'DENY',
  adminId?: string,
  callerRole?: string,
  adminNote?: string
) => {
  if (callerRole !== 'ADMIN') throw new AppError(403, 'Only admins can decide teacher change requests');
  const request = await prisma.teacherChangeRequest.findUnique({ where: { id } });
  if (!request) throw new AppError(404, 'Request not found');
  if (request.status !== 'PENDING') throw new AppError(409, 'Request already decided');

  const updated = await prisma.teacherChangeRequest.update({
    where: { id },
    data: {
      status: action === 'APPROVE' ? 'APPROVED' : 'DENIED',
      adminNote: adminNote ?? null,
    },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
      currentTeacher: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  // Notify the student of the decision (socket + email + push)
  const { notifyTeacherChangeDecision } = await import('./notification.service');
  await notifyTeacherChangeDecision(updated.studentId, updated);

  return updated;
};
