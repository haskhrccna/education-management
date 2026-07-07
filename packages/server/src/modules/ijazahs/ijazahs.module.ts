import { ijazahsContracts } from '@quran-review/shared';
import * as ijazahService from '../../services/ijazah.service';
import { auditLog } from '../../lib/audit';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const issue = defineRoute(ijazahsContracts.issue, async ({ body, userId, req }) => {
  const data = await ijazahService.issueIjazah(userId!, body.studentId, body.scope, {
    surahId: body.surahId,
    juzNumber: body.juzNumber,
    teacherChainRef: body.teacherChainRef,
    chainIjazahId: body.chainIjazahId,
  });
  // Roadmap 3.1: "admins can audit ijazah records issued program-wide" —
  // the existing audit-log pattern, same as grades.module.ts.
  await auditLog({
    userId: userId!,
    action: 'ISSUE_IJAZAH',
    resourceType: 'IJAZAH',
    resourceId: data.id,
    details: { studentId: body.studentId, scope: body.scope, surahId: body.surahId, juzNumber: body.juzNumber },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  return { status: 201 as const, body: { success: true as const, data } };
});

const list = defineRoute(ijazahsContracts.list, async ({ userId, userRole }) => {
  const data = await ijazahService.listIjazahs(userId!, userRole as 'STUDENT' | 'TEACHER' | 'ADMIN');
  return { status: 200 as const, body: { success: true as const, data } };
});

const get = defineRoute(ijazahsContracts.get, async ({ params, userId, userRole }) => {
  const data = await ijazahService.getIjazah(String(params.id), userId!, userRole as 'STUDENT' | 'TEACHER' | 'ADMIN');
  return { status: 200 as const, body: { success: true as const, data } };
});

export const ijazahsRouter = buildContractRouter([issue, list, get], { mountPrefix: '/api/v1/ijazahs' });
