import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';

type UserRoleInput = 'STUDENT' | 'TEACHER' | 'ADMIN';

export const createAppointment = async (studentId: string, teacherId: string, requestedDate: string, requestedTime: string, durationMinutes: number) => {
  const teacherUser = await prisma.user.findUnique({ where: { id: teacherId } });
  if (!teacherUser || teacherUser.role !== 'TEACHER') throw new AppError(400, 'Invalid teacher');

  const conflict = await prisma.appointment.findFirst({
    where: {
      teacherId,
      requestedDate: new Date(requestedDate),
      status: { in: ['REQUESTED', 'ACCEPTED'] },
    },
  });
  if (conflict) throw new AppError(409, 'Teacher already has an appointment at this time');

  return await prisma.appointment.create({
    data: { studentId, teacherId, requestedDate: new Date(requestedDate), requestedTime, durationMinutes },
  });
};

export const getMyAppointments = async (userId: string, userRole: UserRoleInput) => {
  if (userRole === 'STUDENT') {
    return await prisma.appointment.findMany({
      where: { studentId: userId },
      include: { teacher: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { requestedDate: 'desc' },
    });
  }
  return await prisma.appointment.findMany({
    where: { teacherId: userId },
    include: { student: { select: { id: true, firstName: true, lastName: true, email: true } } },
    orderBy: { requestedDate: 'desc' },
  });
};

export const manageAppointment = async (appointmentId: string, userId: string, userRole: string, action: string, amendedNote?: string) => {
  const validActions = ['ACCEPTED', 'AMENDED', 'REJECTED'];
  if (!validActions.includes(action)) throw new AppError(400, 'Invalid action');

  const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appointment) throw new AppError(404, 'Appointment not found');
  if (userRole !== 'ADMIN' && appointment.teacherId !== userId) {
    throw new AppError(403, 'You can only manage your own appointments');
  }

  const updateData: Record<string, unknown> = { status: action };
  if (action === 'ACCEPTED') updateData.approvedAt = new Date();
  if (action === 'REJECTED') updateData.rejectedAt = new Date();
  if (amendedNote) updateData.amendedNote = amendedNote;

  const updated = await prisma.appointment.update({ where: { id: appointmentId }, data: updateData });

  // Notify student of schedule change
  const { notifyScheduleChange } = await import('./socket.service');
  notifyScheduleChange(appointment.studentId, updated);

  return updated;
};
