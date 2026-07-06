import { parentLinksContracts } from '@quran-review/shared';
import * as digestService from '../../services/digest.service';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const setDigestPreference = defineRoute(parentLinksContracts.setDigestPreference, async ({ params, body, userId }) => {
  const updated = await digestService.setDigestOptOut(userId!, String(params.id), body.digestOptOut);
  return { status: 200 as const, body: { id: updated.id, digestOptOut: updated.digestOptOut } };
});

export const parentLinksRouter = buildContractRouter([setDigestPreference], {
  mountPrefix: '/api/v1/parent-links',
});
