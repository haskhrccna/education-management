import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import { deleteUser } from './admin.service';

/**
 * Roadmap 4.2: a full self-service export of everything the platform
 * holds about the caller — GDPR/COPPA "right to data portability".
 * Deliberately scoped to the caller's own userId only; there is no
 * "export someone else's data" variant of this function.
 */
export const exportMyData = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
      createdAt: true,
      guardianConsentStatus: true,
      guardianConsentAt: true,
    },
  });
  if (!user) throw new AppError(404, 'User not found');

  const [
    appointmentsAsStudent,
    appointmentsAsTeacher,
    gradesReceived,
    gradesGiven,
    recordings,
    memorizationProgresses,
    revisionSchedules,
    messagesSent,
    messagesReceived,
    certificates,
    ijazahsAsStudent,
    ijazahsAsTeacher,
    streak,
    parentLinksAsParent,
    parentLinksAsStudent,
  ] = await Promise.all([
    prisma.appointment.findMany({ where: { studentId: userId } }),
    prisma.appointment.findMany({ where: { teacherId: userId } }),
    prisma.grade.findMany({ where: { studentId: userId } }),
    prisma.grade.findMany({ where: { teacherId: userId } }),
    prisma.recording.findMany({ where: { studentId: userId } }),
    prisma.memorizationProgress.findMany({ where: { userId } }),
    prisma.revisionSchedule.findMany({ where: { userId } }),
    prisma.message.findMany({ where: { senderId: userId } }),
    prisma.message.findMany({ where: { receiverId: userId } }),
    prisma.certificate.findMany({ where: { studentId: userId } }),
    prisma.ijazah.findMany({ where: { studentId: userId } }),
    prisma.ijazah.findMany({ where: { teacherId: userId } }),
    prisma.streak.findUnique({ where: { userId } }),
    prisma.parentLink.findMany({ where: { parentId: userId } }),
    prisma.parentLink.findMany({ where: { studentId: userId } }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    profile: user,
    appointments: { asStudent: appointmentsAsStudent, asTeacher: appointmentsAsTeacher },
    grades: { received: gradesReceived, given: gradesGiven },
    recordings,
    memorizationProgresses,
    revisionSchedules,
    messages: { sent: messagesSent, received: messagesReceived },
    certificates,
    ijazahs: { asStudent: ijazahsAsStudent, asTeacher: ijazahsAsTeacher },
    streak,
    parentLinks: { asParent: parentLinksAsParent, asStudent: parentLinksAsStudent },
  };
};

/** Reuses the existing admin anonymization exactly — self-triggered on the caller's own account. */
export const deleteMyAccount = async (userId: string) => deleteUser(userId);
