import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';

function escapeCsv(value: unknown): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(rows: Record<string, unknown>[], headers: string[]): string {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsv(row[h])).join(','));
  }
  return lines.join('\n');
}

async function assertTeacherCanAccessStudent(teacherId: string, studentId: string) {
  const appt = await prisma.appointment.findFirst({
    where: { teacherId, studentId, status: 'ACCEPTED' },
    select: { id: true },
  });
  if (!appt) throw new AppError(403, 'No accepted appointment with this student');
}

export const exportGradesCsv = async (
  studentId?: string,
  teacherId?: string,
  callerId?: string,
  callerRole?: string
) => {
  if (callerRole === 'TEACHER' && callerId && studentId) {
    await assertTeacherCanAccessStudent(callerId, studentId);
  }

  // If a teacher calls without a studentId, restrict to their own accepted students
  let studentIdsFilter: string[] | undefined;
  if (callerRole === 'TEACHER' && callerId && !studentId) {
    const appointments = await prisma.appointment.findMany({
      where: { teacherId: callerId, status: 'ACCEPTED' },
      select: { studentId: true },
    });
    studentIdsFilter = appointments.map((a) => a.studentId);
    if (studentIdsFilter.length === 0) {
      return toCsv([], ['studentName', 'studentEmail', 'teacherName', 'subject', 'grade', 'type', 'notes', 'date']);
    }
  }

  const grades = await prisma.grade.findMany({
    where: {
      ...(studentId && { studentId }),
      ...(teacherId && { teacherId }),
      ...(studentIdsFilter && { studentId: { in: studentIdsFilter } }),
    },
    include: {
      student: { select: { firstName: true, lastName: true, email: true } },
      teacher: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const rows = grades.map((g) => ({
    studentName: `${g.student.firstName} ${g.student.lastName}`,
    studentEmail: g.student.email,
    teacherName: `${g.teacher.firstName} ${g.teacher.lastName}`,
    subject: g.subject,
    grade: g.grade,
    type: g.type,
    notes: g.notes || '',
    date: g.createdAt.toISOString(),
  }));

  return toCsv(rows, ['studentName', 'studentEmail', 'teacherName', 'subject', 'grade', 'type', 'notes', 'date']);
};

export const exportUsersCsv = async (roleFilter?: string) => {
  const users = await prisma.user.findMany({
    where: roleFilter ? { role: roleFilter.toUpperCase() as any } : undefined,
    select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  const rows = users.map((u) => ({
    id: u.id,
    name: `${u.firstName} ${u.lastName}`,
    email: u.email,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt.toISOString(),
  }));

  return toCsv(rows, ['id', 'name', 'email', 'role', 'status', 'createdAt']);
};

export const exportAppointmentsCsv = async (userId?: string, userRole?: string) => {
  const where: { studentId?: string; teacherId?: string } = {};
  if (userId) {
    where[userRole === 'STUDENT' ? 'studentId' : 'teacherId'] = userId;
  }

  const appointments = await prisma.appointment.findMany({
    where,
    include: {
      student: { select: { firstName: true, lastName: true, email: true } },
      teacher: { select: { firstName: true, lastName: true, email: true } },
    },
    orderBy: { requestedDate: 'desc' },
  });

  const rows = appointments.map((a) => ({
    studentName: `${a.student.firstName} ${a.student.lastName}`,
    teacherName: `${a.teacher.firstName} ${a.teacher.lastName}`,
    date: a.requestedDate.toISOString().split('T')[0],
    time: a.requestedTime,
    duration: a.durationMinutes,
    status: a.status,
  }));

  return toCsv(rows, ['studentName', 'teacherName', 'date', 'time', 'duration', 'status']);
};
