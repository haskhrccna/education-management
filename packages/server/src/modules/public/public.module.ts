import { publicContracts } from '@quran-review/shared';
import { getPublicProfile } from '../../services/academy-profile.service';
import { renderShareImage } from '../../services/share-image.service';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const getAcademyProfile = defineRoute(publicContracts.getAcademyProfile, async ({ params }) => {
  const profile = await getPublicProfile(String(params.slug));
  return { status: 200 as const, body: profile };
});

const getShareImage = defineRoute(publicContracts.getShareImage, async ({ params, res }) => {
  const png = await renderShareImage(String(params.token));
  res.setHeader('Content-Type', 'image/png');
  // Public but short-lived: revocation must propagate fast (AC8.3).
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.send(png);
  return { status: 200 as const, handled: true as const };
});

export const publicRouter = buildContractRouter([getAcademyProfile, getShareImage], {
  mountPrefix: '/api/v1/public',
});
