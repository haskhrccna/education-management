import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import type { ZodUpsertAcademyProfileInput } from '@quran-review/shared';

export const DEFAULT_SLUG = 'default';

export const getPublicProfile = async (slug: string) => {
  // Allowlist-by-inclusion: only these fields are ever public, regardless of
  // what columns get added to AcademyProfile in the future (was previously
  // allowlist-by-exclusion via destructure, which leaks new columns by default).
  const profile = await prisma.academyProfile.findUnique({
    where: { slug },
    select: {
      slug: true,
      displayName: true,
      publicBio: true,
      programName: true,
      logoUrl: true,
      contactEmail: true,
      updatedAt: true,
      active: true,
    },
  });
  if (!profile || !profile.active) throw new AppError(404, 'Academy not found');
  const { active: _active, ...pub } = profile;
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
