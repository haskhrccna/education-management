import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';

export const submitTeacherChangeRequest = async (studentId: string, reason: string) => {
  const appointment = await prisma.appointment.findFirst({
    where: { studentId, status: 'ACCEPTED' },
    select: { teacherId: true },
  });
  if (!appointment) throw new AppError(400, 'You have no assigned teacher');

  const existing = await prisma.teacherChangeRequest.findFirst({
    where: { studentId, status: 'PENDING' },
    select: { id: true },
  });
  if (existing) throw new AppError(409, 'You already have a pending request');

  return await prisma.teacherChangeRequest.create({
    data: {
      studentId,
      currentTeacherId: appointment.teacherId,
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
  adminNote?: string
) => {
  const request = await prisma.teacherChangeRequest.findUnique({ where: { id } });
  if (!request) throw new AppError(404, 'Request not found');
  if (request.status !== 'PENDING') throw new AppError(409, 'Request already decided');

  return await prisma.teacherChangeRequest.update({
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
};
