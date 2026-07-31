import { mediaContracts } from '@quran-review/shared';
import * as fileService from '../../services/file.service';
import * as academyHealthService from '../../services/academy-health.service';
import { generateAcademyHealthPDF } from '../../services/academy-health-pdf.service';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';
import { auditLog } from '../../lib/audit';

// fileAuthenticate (Bearer OR ?token=) comes from each contract's
// authVia: 'headerOrQueryToken' — no route-level middleware needed.

const downloadRecordingFile = defineRoute(
  mediaContracts.downloadRecordingFile,
  async ({ params, userId, userRole, req, res }) => {
    const { filePath, fileName } = await fileService.resolveRecordingDownload(userId!, userRole, String(params.id));
    // Only the newly-granted PARENT path, and only after the resolver has
    // already authorized and located the file — so this logs real access.
    if (userRole === 'PARENT') {
      await auditLog({
        userId: userId!,
        action: 'PARENT_DOWNLOAD_RECORDING',
        resourceType: 'RECORDING',
        resourceId: String(params.id),
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
    }
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.sendFile(filePath);
    return { status: 200 as const, handled: true as const };
  }
);

const downloadReportFile = defineRoute(
  mediaContracts.downloadReportFile,
  async ({ params, userId, userRole, req, res }) => {
    const { filePath, fileName } = await fileService.resolveReportDownload(userId!, userRole, String(params.id));
    if (userRole === 'PARENT') {
      await auditLog({
        userId: userId!,
        action: 'PARENT_DOWNLOAD_REPORT',
        resourceType: 'REPORT',
        resourceId: String(params.id),
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
    }
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.sendFile(filePath);
    return { status: 200 as const, handled: true as const };
  }
);

const downloadCertificateFile = defineRoute(
  mediaContracts.downloadCertificateFile,
  async ({ params, userId, userRole, res }) => {
    const { filePath, fileName } = await fileService.resolveCertificateDownload(userId!, userRole, String(params.id));
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.sendFile(filePath);
    return { status: 200 as const, handled: true as const };
  }
);

const downloadAcademyHealthPdf = defineRoute(mediaContracts.downloadAcademyHealthPdf, async ({ res }) => {
  const metrics = await academyHealthService.getAcademyHealth();
  const pdf = await generateAcademyHealthPDF(metrics);
  const dateStamp = metrics.generatedAt.slice(0, 10); // YYYY-MM-DD
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="academy-health-${dateStamp}.pdf"`);
  res.send(pdf);
  return { status: 200 as const, handled: true as const };
});

export const filesRouter = buildContractRouter(
  [downloadRecordingFile, downloadReportFile, downloadCertificateFile, downloadAcademyHealthPdf],
  {
    mountPrefix: '/api/v1/files',
  }
);
