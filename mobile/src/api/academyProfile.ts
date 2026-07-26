import { adminContracts, ZodUpsertAcademyProfileInput } from '@quran-review/shared';
import { contractClient, expectStatus } from './contract';

export interface AcademyProfile {
  id: string;
  slug: string;
  displayName: string;
  publicBio: string | null;
  programName: string;
  logoUrl: string | null;
  contactEmail: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export const academyProfileApi = {
  async get(): Promise<AcademyProfile | null> {
    const res = await contractClient.call(adminContracts.getAcademyProfile);
    if (res.status === 404) return null;
    return expectStatus(res, 200).body as unknown as AcademyProfile;
  },
  async upsert(input: ZodUpsertAcademyProfileInput): Promise<AcademyProfile> {
    const res = expectStatus(await contractClient.call(adminContracts.upsertAcademyProfile, { body: input }), 200);
    return res.body as unknown as AcademyProfile;
  },
};
