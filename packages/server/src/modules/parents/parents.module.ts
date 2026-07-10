import { progressContracts } from '@quran-review/shared';
import * as parentService from '../../services/parent.service';
import { AppError } from '../../middleware/error.middleware';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const roleOf = (userRole?: string): 'PARENT' | 'ADMIN' => (userRole === 'ADMIN' ? 'ADMIN' : 'PARENT');

const requestLink = defineRoute(progressContracts.requestParentLink, async ({ userId, req }) => {
  // Manual validation preserved verbatim from the legacy controller (pinned messages).
  const { studentId, reason } = (req.body ?? {}) as { studentId?: unknown; reason?: unknown };
  if (!studentId || typeof studentId !== 'string') throw new AppError(400, 'studentId is required');
  const link = await parentService.requestLink(
    userId!,
    studentId,
    typeof reason === 'string' && reason.length > 0 ? reason : undefined
  );
  return { status: 201 as const, body: { success: true as const, data: link } };
});

const listLinks = defineRoute(progressContracts.listParentLinks, async ({ userId, userRole }) => {
  const links = await parentService.listLinks(userId!, roleOf(userRole));
  return { status: 200 as const, body: { success: true as const, data: links } };
});

const children = defineRoute(progressContracts.parentChildren, async ({ userId }) => {
  const data = await parentService.getChildren(userId!);
  return { status: 200 as const, body: { success: true as const, data } };
});

const studentSearch = defineRoute(progressContracts.parentStudentSearch, async ({ query }) => {
  const email = String(query.email || '');
  const student = await parentService.findStudentByEmail(email);
  return { status: 200 as const, body: { success: true as const, data: student } };
});

const childDashboard = defineRoute(progressContracts.childDashboard, async ({ userId, params }) => {
  const dashboard = await parentService.getChildDashboard(userId!, String(params.studentId));
  return { status: 200 as const, body: { success: true as const, data: dashboard } };
});

const decideLink = defineRoute(progressContracts.decideParentLink, async ({ userId, params, req }) => {
  const { action, note } = (req.body ?? {}) as { action?: unknown; note?: unknown };
  if (action !== 'APPROVE' && action !== 'DENY') throw new AppError(400, 'action must be APPROVE or DENY');
  const id = String(params.id);
  const updated =
    action === 'APPROVE'
      ? await parentService.approveLink(id, userId!)
      : await parentService.denyLink(id, userId!, typeof note === 'string' ? note : undefined);
  return { status: 200 as const, body: { success: true as const, data: updated } };
});

export const parentsRouter = buildContractRouter(
  [requestLink, listLinks, children, studentSearch, childDashboard, decideLink],
  { mountPrefix: '/api/v1/parents' }
);
