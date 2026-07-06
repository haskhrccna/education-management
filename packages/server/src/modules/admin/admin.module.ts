import { z } from 'zod';
import { adminContracts } from '@quran-review/shared';
import * as adminService from '../../services/admin.service';
import { auditLog } from '../../lib/audit';
import { paginate, paginatedResponse, PaginatedRequest } from '../../middleware/pagination.middleware';
import { broadcastLimiter } from '../../middleware/rate-limit.middleware';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const listUsers = defineRoute(
  adminContracts.listUsers,
  async ({ query, req }) => {
    const roleFilter = query.role as string | undefined;
    const { page = 1, limit = 20, skip = 0 } = (req as PaginatedRequest).pagination || {};
    const { users, total } = await adminService.listUsersPaginated(roleFilter, skip, limit);
    return { status: 200 as const, body: paginatedResponse(users, total, page, limit) };
  },
  { pre: [paginate(20, 100)] }
);

const createTeacher = defineRoute(adminContracts.createTeacher, async ({ body, userId, req }) => {
  const teacher = await adminService.createTeacher(body.email, body.password, body.firstName, body.lastName);
  await auditLog({
    userId: userId!,
    action: 'CREATE_TEACHER',
    resourceType: 'USER',
    resourceId: teacher.id,
    details: { email: body.email },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  return { status: 201 as const, body: teacher };
});

const approveStudent = defineRoute(adminContracts.approveStudent, async ({ params, userId, req }) => {
  const user = await adminService.approveStudent(String(params.id));
  await auditLog({
    userId: userId!,
    action: 'APPROVE_STUDENT',
    resourceType: 'USER',
    resourceId: String(params.id),
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  return { status: 200 as const, body: user };
});

const deactivateUser = defineRoute(adminContracts.deactivateUser, async ({ params, userId, req }) => {
  const user = await adminService.deactivateUser(String(params.id));
  await auditLog({
    userId: userId!,
    action: 'DEACTIVATE_USER',
    resourceType: 'USER',
    resourceId: String(params.id),
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  return { status: 200 as const, body: user };
});

const getUserById = defineRoute(adminContracts.getUserById, async ({ params }) => {
  const result = await adminService.getUserById(String(params.id));
  return { status: 200 as const, body: result };
});

const updateUser = defineRoute(adminContracts.updateUser, async ({ params, body, userId, req }) => {
  const user = await adminService.updateUser(String(params.id), body);
  await auditLog({
    userId: userId!,
    action: 'UPDATE_USER',
    resourceType: 'USER',
    resourceId: String(params.id),
    details: body,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  return { status: 200 as const, body: user };
});

const deleteUser = defineRoute(adminContracts.deleteUser, async ({ params, userId, req }) => {
  const result = await adminService.deleteUser(String(params.id));
  await auditLog({
    userId: userId!,
    action: 'DELETE_USER',
    resourceType: 'USER',
    resourceId: String(params.id),
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  return { status: 200 as const, body: result as { id: string; deleted: true } };
});

const teacherProgress = defineRoute(adminContracts.teacherProgress, async ({ query }) => {
  const progress = await adminService.getTeacherProgress(query.teacherId as string | undefined);
  return { status: 200 as const, body: progress };
});

const studentProgress = defineRoute(adminContracts.studentProgress, async ({ query }) => {
  const progress = await adminService.getStudentProgress(query.studentId as string | undefined);
  return { status: 200 as const, body: progress };
});

const broadcast = defineRoute(
  adminContracts.broadcast,
  async ({ body, userId, req }) => {
    const result = await adminService.broadcastMessage(body.message, body.targetRole);
    await auditLog({
      userId: userId!,
      action: 'BROADCAST',
      resourceType: 'MESSAGE',
      details: { targetRole: body.targetRole, messageLength: body.message.length },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    // Service types `sent` as boolean; the contract pins the literal `true` the service actually returns.
    return { status: 200 as const, body: result as z.infer<(typeof adminContracts.broadcast.responses)[200]> };
  },
  { pre: [broadcastLimiter] }
);

const bulkApprove = defineRoute(adminContracts.bulkApprove, async ({ body, userId, req }) => {
  const results = await adminService.bulkApproveStudents(body.studentIds);
  await auditLog({
    userId: userId!,
    action: 'BULK_APPROVE',
    resourceType: 'USER',
    details: { count: body.studentIds.length },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  return { status: 200 as const, body: results };
});

const bulkDeactivate = defineRoute(adminContracts.bulkDeactivate, async ({ body, userId, req }) => {
  const results = await adminService.bulkDeactivateUsers(body.userIds);
  await auditLog({
    userId: userId!,
    action: 'BULK_DEACTIVATE',
    resourceType: 'USER',
    details: { count: body.userIds.length },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  return { status: 200 as const, body: results };
});

export const adminRouter = buildContractRouter(
  [
    listUsers,
    createTeacher,
    approveStudent,
    deactivateUser,
    getUserById,
    updateUser,
    deleteUser,
    teacherProgress,
    studentProgress,
    broadcast,
    bulkApprove,
    bulkDeactivate,
  ],
  { mountPrefix: '/api/v1/admin' }
);
