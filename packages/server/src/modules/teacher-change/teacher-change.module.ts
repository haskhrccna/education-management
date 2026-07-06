import { schedulingContracts } from '@quran-review/shared';
import * as teacherChangeService from '../../services/teacherChange.service';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const submitTeacherChange = defineRoute(schedulingContracts.submitTeacherChange, async ({ body, userId }) => {
  const result = await teacherChangeService.submitTeacherChangeRequest(userId!, body.reason);
  return { status: 201 as const, body: result };
});

const listTeacherChanges = defineRoute(schedulingContracts.listTeacherChanges, async ({ query, userId, userRole }) => {
  const statusFilter = typeof query.status === 'string' ? query.status : undefined;
  const result = await teacherChangeService.getTeacherChangeRequests(userId!, userRole!, statusFilter);
  return { status: 200 as const, body: result };
});

const decideTeacherChange = defineRoute(
  schedulingContracts.decideTeacherChange,
  async ({ params, body, userId, userRole }) => {
    const result = await teacherChangeService.decideTeacherChangeRequest(
      String(params.id),
      body.action,
      userId,
      userRole,
      body.adminNote,
      body.newTeacherId
    );
    return { status: 200 as const, body: result };
  }
);

export const teacherChangeRouter = buildContractRouter([submitTeacherChange, listTeacherChanges, decideTeacherChange], {
  mountPrefix: '/api/v1/teacher-changes',
});
