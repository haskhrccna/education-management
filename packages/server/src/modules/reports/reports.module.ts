import { mediaContracts } from '@quran-review/shared';
import * as reportService from '../../services/report.service';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const generateReport = defineRoute(mediaContracts.generateReport, async ({ body, userId }) => {
  const report = await reportService.createReport(userId!, body.studentId, body.summary);
  return { status: 201 as const, body: report };
});

const listReports = defineRoute(mediaContracts.listReports, async ({ userId, userRole }) => {
  const reports = await reportService.listMyReports(userId!, userRole);
  return { status: 200 as const, body: reports };
});

export const reportsRouter = buildContractRouter([generateReport, listReports], {
  mountPrefix: '/api/v1/reports',
});
