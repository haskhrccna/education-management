import { prisma } from '../prisma/client';

function escapeCsv(value: any): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(rows: Record<string, any>[], headers: string[]): string {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsv(row[h])).join(','));
  }
  return lines.join('\n');
}

export const exportGradesCsv = async (studentId?: string, teacherId?: string) => {
  const grades = await prisma.grade.findMany({
    where: {
      ...(studentId && { studentId }),
      ...(teacherId && { teacherId }),
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
  const where: any = {};
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
