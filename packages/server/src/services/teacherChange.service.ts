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
  adminNote?: string,
  newTeacherId?: string
) => {
  if (callerRole !== 'ADMIN') throw new AppError(403, 'Only admins can decide teacher change requests');
  const request = await prisma.teacherChangeRequest.findUnique({ where: { id } });
  if (!request) throw new AppError(404, 'Request not found');
  if (request.status !== 'PENDING') throw new AppError(409, 'Request already decided');

  if (action === 'APPROVE' && newTeacherId) {
    const teacher = await prisma.user.findFirst({ where: { id: newTeacherId, role: 'TEACHER' } });
    if (!teacher) throw new AppError(400, 'Invalid teacher');

    // Persist canonical teacher assignment on the student record
    await prisma.user.update({
      where: { id: request.studentId },
      data: { assignedTeacherId: newTeacherId },
    });

    // Reassign existing ACCEPTED & REQUESTED appointments to the new teacher
    await prisma.appointment.updateMany({
      where: { studentId: request.studentId, status: { in: ['ACCEPTED', 'REQUESTED'] } },
      data: { teacherId: newTeacherId },
    });

    // If no ACCEPTED appointment exists, create one so both sides can discover each other
    const existingAccepted = await prisma.appointment.findFirst({
      where: { studentId: request.studentId, status: 'ACCEPTED' },
    });
    if (!existingAccepted) {
      const assignmentDate = new Date();
      assignmentDate.setFullYear(assignmentDate.getFullYear() + 1);
      await prisma.appointment.create({
        data: {
          studentId: request.studentId,
          teacherId: newTeacherId,
          requestedDate: assignmentDate,
          requestedTime: '00:00',
          durationMinutes: 60,
          status: 'ACCEPTED',
          approvedAt: new Date(),
        },
      });
    }
  }

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

  const { notifyTeacherChangeDecision } = await import('./notification.service');
  await notifyTeacherChangeDecision(updated.studentId, updated);

  return updated;
};
