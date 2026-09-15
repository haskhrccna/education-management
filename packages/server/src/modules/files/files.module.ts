import { mediaContracts } from '@quran-review/shared';
import * as fileService from '../../services/file.service';
import * as storageService from '../../services/storage.service';
import * as recordingService from '../../services/recording.service';
import * as academyHealthService from '../../services/academy-health.service';
import { generateAcademyHealthPDF } from '../../services/academy-health-pdf.service';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';
import { auditLog } from '../../lib/audit';
import { AppError } from '../../middleware/error.middleware';

// fileAuthenticate (Bearer OR ?token=) comes from each contract's
// authVia: 'headerOrQueryToken' — no route-level middleware needed.

const downloadRecordingFile = defineRoute(
  mediaContracts.downloadRecordingFile,
  async ({ params, userId, userRole, req, res }) => {
    // S3 flow first: recordings created via POST /files/complete stream from
    // the bucket; legacy local-disk rows fall through unchanged.
    const blob = await fileService.resolveRecordingStorageBlob(userId!, userRole, String(params.id));
    if (blob) {
      // SEC-M4: audit only REAL downloads. Resolve the object first so a
      // missing blob throws 404 BEFORE the audit row is written.
      await storageService.assertObjectExists(blob.storageKey);
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
      res.setHeader('Content-Disposition', `attachment; filename="${blob.fileName}"`);
      res.setHeader('Cache-Control', 'private, no-store');
      await storageService.streamObject(blob.storageKey, res);
      return { status: 200 as const, handled: true as const };
    }

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

const presignUpload = defineRoute(mediaContracts.presignUpload, async ({ body, userId }) => {
  if (!storageService.isStorageEnabled()) throw new AppError(503, 'Object storage is not enabled (STORAGE_ENABLED=1)');
  const prefix = body.kind === 'recording' || !body.kind ? 'recordings' : `${body.kind}s`;
  const result = await storageService.presignUpload(
    `${prefix}/${userId}`,
    body.fileName,
    body.contentType,
    body.fileSizeBytes
  );
  return {
    status: 201 as const,
    body: { storageKey: result.storageKey, uploadUrl: result.uploadUrl, expiresInSeconds: result.expiresInSeconds },
  };
});

const completeUpload = defineRoute(mediaContracts.completeUpload, async ({ body, userId }) => {
  if (!storageService.isStorageEnabled()) throw new AppError(503, 'Object storage is not enabled (STORAGE_ENABLED=1)');
  if (body.recording) {
    const recording = await recordingService.completeRecordingUpload(
      userId!,
      body.storageKey,
      body.recording.fileName,
      body.recording.fileSizeBytes,
      body.recording.contentType,
      body.recording.page,
      body.recording.surahId
    );
    const url = recording.url;
    return { status: 200 as const, body: { recording, url } };
  }
  // Non-recording kinds (report/certificate/upload): verify and resolve only;
  // their rows are still created by their own endpoints.
  const { url } = await storageService.completeUpload(body.storageKey);
  throw new AppError(400, `No recording metadata provided; object verified at ${url} but no row created`);
});

export const filesRouter = buildContractRouter(
  [
    downloadRecordingFile,
    downloadReportFile,
    downloadCertificateFile,
    downloadAcademyHealthPdf,
    presignUpload,
    completeUpload,
  ],
  {
    mountPrefix: '/api/v1/files',
  }
);
