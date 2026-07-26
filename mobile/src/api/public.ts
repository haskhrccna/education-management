import { publicContracts } from '@quran-review/shared';
import { contractClient, expectStatus } from './contract';

export interface AcademyProfilePublic {
  slug: string;
  displayName: string;
  publicBio: string | null;
  programName: string;
  logoUrl: string | null;
  contactEmail: string | null;
  updatedAt: string;
}

export const publicApi = {
  async getAcademyProfile(slug: string): Promise<AcademyProfilePublic> {
    const res = expectStatus(await contractClient.call(publicContracts.getAcademyProfile, { params: { slug } }), 200);
    return res.body as unknown as AcademyProfilePublic;
  },
};
