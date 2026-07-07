import { parentLinksContracts } from '@quran-review/shared';
import * as digestService from '../../services/digest.service';
import * as guardianConsentService from '../../services/guardian-consent.service';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const setDigestPreference = defineRoute(parentLinksContracts.setDigestPreference, async ({ params, body, userId }) => {
  const updated = await digestService.setDigestOptOut(userId!, String(params.id), body.digestOptOut);
  return { status: 200 as const, body: { id: updated.id, digestOptOut: updated.digestOptOut } };
});

const decideConsent = defineRoute(parentLinksContracts.decideConsent, async ({ params, body, userId }) => {
  const student = await guardianConsentService.decideConsent(userId!, String(params.id), body.granted);
  return { status: 200 as const, body: { id: student.id, guardianConsentStatus: student.guardianConsentStatus } };
});

export const parentLinksRouter = buildContractRouter([setDigestPreference, decideConsent], {
  mountPrefix: '/api/v1/parent-links',
});
