import { certificatesContracts } from '@quran-review/shared';
import { regenerateCertificateLink } from '../../services/verification.service';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const regenerateLink = defineRoute(certificatesContracts.regenerateLink, async ({ params, userId }) => {
  const data = await regenerateCertificateLink(String(params.id), userId!);
  return { status: 200 as const, body: { success: true as const, data } };
});

export const certificatesRouter = buildContractRouter([regenerateLink], { mountPrefix: '/api/v1/certificates' });
