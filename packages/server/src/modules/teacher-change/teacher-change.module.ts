import { schedulingContracts } from '@quran-review/shared';
import * as teacherChangeService from '../../services/teacherChange.service';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';
import { auditLog } from '../../lib/audit';

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
  async ({ params, body, userId, userRole, req }) => {
    const result = await teacherChangeService.decideTeacherChangeRequest(
      String(params.id),
      body.action,
      userId,
      userRole,
      body.adminNote,
      body.newTeacherId
    );
    await auditLog({
      userId: userId!,
      action: 'DECIDE_TEACHER_CHANGE',
      resourceType: 'TEACHER_CHANGE_REQUEST',
      resourceId: result.id,
      details: { action: body.action, ...(body.newTeacherId ? { newTeacherId: body.newTeacherId } : {}) },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return { status: 200 as const, body: result };
  }
);

export const teacherChangeRouter = buildContractRouter([submitTeacherChange, listTeacherChanges, decideTeacherChange], {
  mountPrefix: '/api/v1/teacher-changes',
});
