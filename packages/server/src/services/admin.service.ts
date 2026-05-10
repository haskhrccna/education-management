import { prisma } from '../prisma/client';
import { hashPassword } from './auth.service';
import { AppError } from '../middleware/error.middleware';
import { addBroadcastJob } from '../lib/queue';
import { sendAccountApprovedEmail } from './email.service';
import { sendToUser } from './socket.service';

const MAX_BULK_IDS = 1000;

export const listUsers = async (roleFilter?: string) => {
  return await prisma.user.findMany({
    where: {
      ...(roleFilter ? { role: roleFilter.toUpperCase() as 'STUDENT' | 'TEACHER' | 'ADMIN' } : {}),
      deletedAt: null,
    },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
};

export const listUsersPaginated = async (roleFilter?: string, skip = 0, take = 20) => {
  const where = {
    ...(roleFilter ? { role: roleFilter.toUpperCase() as 'STUDENT' | 'TEACHER' | 'ADMIN' } : {}),
    deletedAt: null,
  };
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.user.count({ where: { ...where, deletedAt: null } }),
  ]);
  return { users, total };
};

export const createTeacher = async (email: string, password: string, firstName: string, lastName: string) => {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError(409, 'Email already registered');

  const passwordHash = await hashPassword(password);
  return await prisma.user.create({
    data: { email, passwordHash, role: 'TEACHER', firstName, lastName, status: 'ACTIVE' },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true },
  });
};

export const approveStudent = async (studentId: string) => {
  const student = await prisma.user.findUnique({ where: { id: studentId } });
  if (!student) throw new AppError(404, 'Student not found');
  if (student.role !== 'STUDENT') throw new AppError(400, 'User is not a student');

  const updated = await prisma.user.update({
    where: { id: studentId },
    data: { status: 'ACTIVE' },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true },
  });

  // Send approval email
  const { sendAccountApprovedEmail } = await import('./email.service');
  await sendAccountApprovedEmail(updated.email, updated.firstName);

  return updated;
};

export const deactivateUser = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found');

  return await prisma.user.update({
    where: { id: userId },
    data: { status: 'BANNED' },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true },
  });
};

export const getTeacherProgress = async (teacherId?: string) => {
  if (teacherId) {
    return await prisma.user.findUnique({
      where: { id: teacherId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        appointmentsAsTeacher: { where: { status: 'ACCEPTED' }, select: { id: true } },
        gradesGiven: { select: { id: true, grade: true, type: true } },
      },
    });
  }
  const teachers = await prisma.user.findMany({
    where: { role: 'TEACHER', status: 'ACTIVE' },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      appointmentsAsTeacher: { where: { status: 'ACCEPTED' }, select: { id: true } },
      gradesGiven: { select: { grade: true } },
    },
  });
  return teachers.map((t) => ({
    id: t.id,
    email: t.email,
    name: `${t.firstName} ${t.lastName}`,
    acceptedAppointments: t.appointmentsAsTeacher.length,
    gradesGiven: t.gradesGiven.length,
    averageGrade: safeAverage(t.gradesGiven.map((g) => g.grade)),
  }));
};

export const getStudentProgress = async (studentId?: string) => {
  if (studentId) {
    return await prisma.user.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        gradesReceived: { select: { id: true, grade: true, subject: true, type: true } },
        appointmentsAsStudent: { where: { status: 'ACCEPTED' }, select: { id: true } },
      },
    });
  }
  const students = await prisma.user.findMany({
    where: { role: 'STUDENT', status: 'ACTIVE' },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      gradesReceived: { select: { grade: true, subject: true, type: true } },
      appointmentsAsStudent: { where: { status: 'ACCEPTED' }, select: { id: true } },
    },
  });
  return students.map((s) => ({
    id: s.id,
    email: s.email,
    name: `${s.firstName} ${s.lastName}`,
    gradesReceived: s.gradesReceived.length,
    acceptedAppointments: s.appointmentsAsStudent.length,
    averageGrade: safeAverage(s.gradesReceived.map((g) => g.grade)),
  }));
};

function safeAverage(grades: string[]): number {
  const nums = grades.map((g) => parseFloat(g)).filter((n) => !isNaN(n));
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export const broadcastMessage = async (message: string, targetRole?: string) => {
  // Add to background queue if Redis is available
  const job = await addBroadcastJob(message, targetRole);
  if (job) {
    return { sent: true, queued: true, message };
  }

  // Fallback: synchronous broadcast (for dev without Redis)
  const where = targetRole ? { role: targetRole.toUpperCase() as 'STUDENT' | 'TEACHER' | 'ADMIN' } : {};
  const users = await prisma.user.findMany({ where, select: { id: true } });

  let sentCount = 0;
  for (const user of users) {
    sendToUser(user.id, 'broadcast', { message, sentAt: new Date().toISOString() });
    sentCount++;
  }

  return { sent: true, recipients: sentCount, message };
};

export const bulkApproveStudents = async (studentIds: string[]) => {
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    throw new AppError(400, 'studentIds array is required');
  }
  if (studentIds.length > MAX_BULK_IDS) {
    throw new AppError(400, `Maximum ${MAX_BULK_IDS} students per request`);
  }

  return await prisma.$transaction(async (tx) => {
    const students = await tx.user.findMany({
      where: { id: { in: studentIds }, role: 'STUDENT' },
      select: { id: true, email: true, firstName: true, status: true },
    });

    const studentMap = new Map(students.map((s) => [s.id, s]));
    const results: { id: string; success: boolean; reason?: string }[] = [];

    for (const id of studentIds) {
      const student = studentMap.get(id);
      if (!student) {
        results.push({ id, success: false, reason: 'Student not found' });
        continue;
      }
      if (student.status === 'ACTIVE') {
        results.push({ id, success: false, reason: 'Already active' });
        continue;
      }

      await tx.user.update({ where: { id }, data: { status: 'ACTIVE' } });
      results.push({ id, success: true });
    }

    return results;
  });
};

export const getUserById = async (userId: string) => {
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
      updatedAt: true,
      emailVerifiedAt: true,
      // deviceToken intentionally excluded — push tokens are sensitive credentials
      appointmentsAsStudent: {
        select: {
          id: true,
          status: true,
          requestedDate: true,
          createdAt: true,
          teacher: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
      appointmentsAsTeacher: {
        select: {
          id: true,
          status: true,
          requestedDate: true,
          createdAt: true,
          student: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
      gradesReceived: { select: { id: true, grade: true, subject: true, type: true, createdAt: true } },
      gradesGiven: { select: { id: true, grade: true, subject: true, type: true, createdAt: true } },
      messagesSent: { select: { id: true } },
      messagesReceived: { select: { id: true } },
    },
  });
  if (!user) throw new AppError(404, 'User not found');

  const isStudent = user.role === 'STUDENT';
  const isTeacher = user.role === 'TEACHER';

  // Get unique teachers for students
  const teachers = isStudent
    ? Array.from(
        user.appointmentsAsStudent
          .reduce((map, a) => {
            if (!map.has(a.teacher.id)) map.set(a.teacher.id, a.teacher);
            return map;
          }, new Map<string, { id: string; firstName: string; lastName: string; email: string; joinedAt?: Date }>())
          .values()
      )
    : [];

  // Get unique students for teachers with joining date (first appointment)
  const students = isTeacher
    ? Array.from(
        user.appointmentsAsTeacher
          .reduce((map, a) => {
            if (!map.has(a.student.id)) {
              map.set(a.student.id, { ...a.student, joinedAt: a.createdAt });
            }
            return map;
          }, new Map<string, { id: string; firstName: string; lastName: string; email: string; joinedAt?: Date }>())
          .values()
      )
    : [];

  const analytics = {
    totalAppointments: isStudent
      ? user.appointmentsAsStudent.length
      : isTeacher
        ? user.appointmentsAsTeacher.length
        : 0,
    acceptedAppointments: isStudent
      ? user.appointmentsAsStudent.filter((a) => a.status === 'ACCEPTED').length
      : isTeacher
        ? user.appointmentsAsTeacher.filter((a) => a.status === 'ACCEPTED').length
        : 0,
    totalGrades: isStudent ? user.gradesReceived.length : isTeacher ? user.gradesGiven.length : 0,
    averageGrade: safeAverage(
      isStudent ? user.gradesReceived.map((g) => g.grade) : isTeacher ? user.gradesGiven.map((g) => g.grade) : []
    ),
    totalMessages: user.messagesSent.length + user.messagesReceived.length,
    memberSince: user.createdAt,
    lastActive: user.updatedAt,
    teachers,
    students,
  };

  return { user, analytics };
};

export const updateUser = async (
  userId: string,
  data: { firstName?: string; lastName?: string; email?: string; status?: string; role?: string }
) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found');

  const updateData: Record<string, unknown> = {};
  if (data.firstName) updateData.firstName = data.firstName;
  if (data.lastName) updateData.lastName = data.lastName;
  if (data.email) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing && existing.id !== userId) throw new AppError(409, 'Email already in use');
    updateData.email = data.email;
  }
  if (data.status) updateData.status = data.status;
  if (data.role) {
    if (!['STUDENT', 'TEACHER', 'ADMIN'].includes(data.role)) throw new AppError(400, 'Invalid role');
    updateData.role = data.role;
  }

  return await prisma.user.update({
    where: { id: userId },
    data: updateData as Record<string, unknown>,
    select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true, createdAt: true },
  });
};

export const deleteUser = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found');

  // Soft-delete: anonymize PII while preserving relationship integrity and audit trail.
  // Hard cascade via Prisma relations (onDelete: Cascade) removes child records,
  // but we keep the user row for compliance — email + names are replaced with
  // a deterministic "deleted" identity so foreign keys remain valid.
  await prisma.user.update({
    where: { id: userId },
    data: {
      status: 'BANNED',
      firstName: 'Deleted User',
      lastName: '',
      email: `deleted-${userId}@deleted.local`,
      passwordHash: 'DELETED',
      refreshTokenHash: null,
      deviceToken: null,
      deletedAt: new Date(),
    },
  });

  return { id: userId, deleted: true };
};

export const bulkDeactivateUsers = async (userIds: string[]) => {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw new AppError(400, 'userIds array is required');
  }
  if (userIds.length > MAX_BULK_IDS) {
    throw new AppError(400, `Maximum ${MAX_BULK_IDS} users per request`);
  }

  return await prisma.$transaction(async (tx) => {
    const users = await tx.user.findMany({
      where: { id: { in: userIds }, deletedAt: null },
      select: { id: true },
    });

    const userSet = new Set(users.map((u) => u.id));
    const results: { id: string; success: boolean; reason?: string }[] = [];

    for (const id of userIds) {
      if (!userSet.has(id)) {
        results.push({ id, success: false, reason: 'User not found' });
        continue;
      }

      await tx.user.update({ where: { id }, data: { status: 'BANNED' } });
      results.push({ id, success: true });
    }

    return results;
  });
};
