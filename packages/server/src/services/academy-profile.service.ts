import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import type { ZodUpsertAcademyProfileInput } from '@quran-review/shared';

export const DEFAULT_SLUG = 'default';

export const getPublicProfile = async (slug: string) => {
  const profile = await prisma.academyProfile.findUnique({ where: { slug } });
  if (!profile || !profile.active) throw new AppError(404, 'Academy not found');
  const { id: _id, active: _active, createdAt: _c, ...pub } = profile;
  return pub;
};

/** Branding lookup for verify page + share image — null (never throws) when unset/inactive. */
export const getActiveDefaultProfile = async () => {
  const profile = await prisma.academyProfile.findUnique({ where: { slug: DEFAULT_SLUG } });
  return profile?.active ? profile : null;
};

export const getAdminProfile = async () => {
  const profile = await prisma.academyProfile.findUnique({ where: { slug: DEFAULT_SLUG } });
  if (!profile) throw new AppError(404, 'Academy profile not set up yet');
  return profile;
};

export const upsertProfile = (input: ZodUpsertAcademyProfileInput) => {
  const data = {
    displayName: input.displayName,
    programName: input.programName,
    publicBio: input.publicBio ?? null,
    logoUrl: input.logoUrl ?? null,
    contactEmail: input.contactEmail ?? null,
    active: input.active ?? true,
  };
  return prisma.academyProfile.upsert({
    where: { slug: DEFAULT_SLUG },
    create: { slug: DEFAULT_SLUG, ...data },
    update: data,
  });
};
