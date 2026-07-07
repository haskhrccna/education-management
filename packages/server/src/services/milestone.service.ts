import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';

export type MilestoneTriggerType =
  'SURAH_COUNT' | 'REVISION_COUNT' | 'STREAK_LENGTH' | 'PLAN_COMPLETION' | 'IJAZAH_ISSUED' | 'HALAQA_ATTENDANCE_COUNT';

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * An admin defines a new milestone — name plus a trigger — without a code
 * deploy (roadmap 3.2). Creates the underlying Badge and its
 * MilestoneDefinition together; evaluateMilestones picks it up on its next
 * run for every user, no restart required.
 */
export const createMilestone = async (
  name: string,
  description: string,
  iconKey: string,
  triggerType: MilestoneTriggerType,
  threshold: number
) => {
  if (threshold <= 0) throw new AppError(400, 'threshold must be a positive number');

  const code = slugify(name);
  if (!code) throw new AppError(400, 'name must contain at least one letter or number');

  const existing = await prisma.badge.findUnique({ where: { code } });
  if (existing) throw new AppError(409, `A milestone with code "${code}" already exists`);

  const badge = await prisma.badge.create({ data: { code, name, description, iconKey } });
  const definition = await prisma.milestoneDefinition.create({
    data: { badgeCode: badge.code, triggerType, threshold },
    include: { badge: true },
  });
  return definition;
};

export const listMilestones = async () => {
  return prisma.milestoneDefinition.findMany({
    include: { badge: true },
    orderBy: { createdAt: 'asc' },
  });
};
