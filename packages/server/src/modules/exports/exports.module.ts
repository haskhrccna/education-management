import { mediaContracts } from '@quran-review/shared';
import * as exportService from '../../services/export.service';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const exportGrades = defineRoute(mediaContracts.exportGrades, async ({ query, userId, userRole, res }) => {
  const studentId = query.studentId as string | undefined;
  const teacherId = query.teacherId as string | undefined;
  const csv = await exportService.exportGradesCsv(studentId, teacherId, userId, userRole);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="grades.csv"');
  res.send(csv);
  return { status: 200 as const, handled: true as const };
});

const exportAppointments = defineRoute(mediaContracts.exportAppointments, async ({ userId, userRole, res }) => {
  const csv = await exportService.exportAppointmentsCsv(userId, userRole);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="appointments.csv"');
  res.send(csv);
  return { status: 200 as const, handled: true as const };
});

const exportUsers = defineRoute(mediaContracts.exportUsers, async ({ query, res }) => {
  const role = query.role as string | undefined;
  const csv = await exportService.exportUsersCsv(role);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
  res.send(csv);
  return { status: 200 as const, handled: true as const };
});

export const exportsRouter = buildContractRouter([exportGrades, exportAppointments, exportUsers], {
  mountPrefix: '/api/v1/exports',
});
