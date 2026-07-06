import { learningContracts } from '@quran-review/shared';
import * as gradeService from '../../services/grade.service';
import { auditLog } from '../../lib/audit';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const listGrades = defineRoute(learningContracts.listGrades, async ({ userId }) => {
  const grades = await gradeService.getMyGrades(userId!);
  return { status: 200 as const, body: grades };
});

const createGrade = defineRoute(learningContracts.createGrade, async ({ body, userId, req }) => {
  const created = await gradeService.createGrade(
    userId!,
    body.studentId,
    body.surahId,
    body.grade,
    body.type as 'QUIZ' | 'ASSIGNMENT' | 'EXAM' | 'ORAL' | 'PARTICIPATION',
    body.notes
  );
  await auditLog({
    userId: userId!,
    action: 'CREATE_GRADE',
    resourceType: 'GRADE',
    resourceId: created.id,
    details: { studentId: body.studentId, surahId: body.surahId, type: body.type },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  return { status: 201 as const, body: created };
});

const studentGrades = defineRoute(learningContracts.studentGrades, async ({ params, userId, userRole }) => {
  const grades = await gradeService.getStudentGrades(userId!, userRole!, String(params.id));
  return { status: 200 as const, body: grades };
});

export const gradesRouter = buildContractRouter([listGrades, createGrade, studentGrades], {
  mountPrefix: '/api/v1/grades',
});
