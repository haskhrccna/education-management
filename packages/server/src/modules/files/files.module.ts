import { mediaContracts } from '@quran-review/shared';
import * as fileService from '../../services/file.service';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

// fileAuthenticate (Bearer OR ?token=) comes from each contract's
// authVia: 'headerOrQueryToken' — no route-level middleware needed.

const downloadRecordingFile = defineRoute(
  mediaContracts.downloadRecordingFile,
  async ({ params, userId, userRole, res }) => {
    const { filePath, fileName } = await fileService.resolveRecordingDownload(userId!, userRole, String(params.id));
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.sendFile(filePath);
    return { status: 200 as const, handled: true as const };
  }
);

const downloadReportFile = defineRoute(mediaContracts.downloadReportFile, async ({ params, userId, userRole, res }) => {
  const { filePath, fileName } = await fileService.resolveReportDownload(userId!, userRole, String(params.id));
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.sendFile(filePath);
  return { status: 200 as const, handled: true as const };
});

const downloadCertificateFile = defineRoute(
  mediaContracts.downloadCertificateFile,
  async ({ params, userId, userRole, res }) => {
    const { filePath, fileName } = await fileService.resolveCertificateDownload(userId!, userRole, String(params.id));
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.sendFile(filePath);
    return { status: 200 as const, handled: true as const };
  }
);

export const filesRouter = buildContractRouter([downloadRecordingFile, downloadReportFile, downloadCertificateFile], {
  mountPrefix: '/api/v1/files',
});
