import { certificatesContracts } from '@quran-review/shared';
import { regenerateCertificateLink } from '../../services/verification.service';
import * as certificateService from '../../services/certificate.service';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const listCertificates = defineRoute(certificatesContracts.listCertificates, async ({ userId, userRole, query }) => {
  const filter = typeof query.studentId === 'string' ? query.studentId : undefined;
  const certs = await certificateService.listCertificates(userId!, userRole, filter);
  return { status: 200 as const, body: { success: true as const, data: certs } };
});

const regenerateLink = defineRoute(certificatesContracts.regenerateLink, async ({ params, userId }) => {
  const data = await regenerateCertificateLink(String(params.id), userId!);
  return { status: 200 as const, body: { success: true as const, data } };
});

export const certificatesRouter = buildContractRouter([listCertificates, regenerateLink], {
  mountPrefix: '/api/v1/certificates',
});
