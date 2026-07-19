import { prisma } from '../prisma/client';
import { assertCanViewStudent } from './page-memorization.service';
import { revisionQueueCache, revisionQueueKey } from '../lib/cache';

export type RevisionBand = 'OVERRIDE' | 'MANZIL' | 'SABQI' | 'SABAQ';

export interface RevisionQueueItem {
  page: number | null;
  surahId: number | null;
  band: RevisionBand;
  overdueDays: number;
}

export interface RevisionQueueResult {
  items: RevisionQueueItem[];
  /** Adherence numerator: pages reviewed in the last 7 days (AC3.6). */
  reviewedThisWeek: number;
}

// Classical Sabaq/Sabqi/Manzil defaults. Pedagogy lives in constants, not
// schema (spec risk table): new material daily, recent every 3 days, old
// weekly. A weak-flagged page tightens one band. Teacher overrides always win.
const SABAQ_MAX_AGE_DAYS = 7;
const SABQI_MAX_AGE_DAYS = 30;
const INTERVAL_DAYS: Record<Exclude<RevisionBand, 'OVERRIDE'>, number> = { SABAQ: 1, SABQI: 3, MANZIL: 7 };
const BOOSTED_INTERVAL_DAYS: Record<Exclude<RevisionBand, 'OVERRIDE'>, number> = { SABAQ: 1, SABQI: 1, MANZIL: 3 };
const DAY_MS = 86400000;
const CACHE_TTL_MS = 3600_000;

export interface RevisionQueueInput {
  today: Date;
  pages: { page: number; status: string; lastReviewedAt: Date | null; updatedAt: Date }[];
  weakPages: Set<number>;
  overrides: { surahId: number; scheduledFor: Date }[];
}

/** Pure and deterministic: same input → same queue. No I/O, no RNG (AC3.1). */
export function buildRevisionQueue(input: RevisionQueueInput): RevisionQueueItem[] {
  const { today, pages, weakPages, overrides } = input;

  const pageItems: RevisionQueueItem[] = [];
  for (const p of pages) {
    if (p.status !== 'MEMORIZED' && p.status !== 'SOLID') continue;
    const ageDays = Math.floor((today.getTime() - p.updatedAt.getTime()) / DAY_MS);
    const band: Exclude<RevisionBand, 'OVERRIDE'> =
      ageDays < SABAQ_MAX_AGE_DAYS ? 'SABAQ' : ageDays <= SABQI_MAX_AGE_DAYS ? 'SABQI' : 'MANZIL';
    const interval = weakPages.has(p.page) ? BOOSTED_INTERVAL_DAYS[band] : INTERVAL_DAYS[band];
    const lastReview = p.lastReviewedAt ?? p.updatedAt;
    const sinceReviewDays = Math.floor((today.getTime() - lastReview.getTime()) / DAY_MS);
    if (sinceReviewDays >= interval) {
      pageItems.push({ page: p.page, surahId: null, band, overdueDays: sinceReviewDays - interval });
    }
  }

  const bandRank: Record<RevisionBand, number> = { OVERRIDE: 0, MANZIL: 1, SABQI: 2, SABAQ: 3 };
  pageItems.sort(
    (a, b) => bandRank[a.band] - bandRank[b.band] || b.overdueDays - a.overdueDays || (a.page ?? 0) - (b.page ?? 0)
  );

  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);
  const overrideItems: RevisionQueueItem[] = overrides
    .filter((o) => o.scheduledFor.getTime() <= endOfToday.getTime())
    .map((o) => ({
      page: null,
      surahId: o.surahId,
      band: 'OVERRIDE' as const,
      overdueDays: Math.max(0, Math.floor((today.getTime() - o.scheduledFor.getTime()) / DAY_MS)),
    }))
    .sort((a, b) => b.overdueDays - a.overdueDays || (a.surahId ?? 0) - (b.surahId ?? 0));

  return [...overrideItems, ...pageItems];
}

/** Cache-aside wrapper (AC3.5): compute from rows, cache 1h, writes invalidate. */
export async function getRevisionQueue(
  requesterId: string,
  requesterRole: 'STUDENT' | 'TEACHER' | 'ADMIN' | 'PARENT',
  studentId?: string
): Promise<RevisionQueueResult> {
  const target = studentId ?? requesterId;
  await assertCanViewStudent(requesterId, requesterRole, target);

  const key = revisionQueueKey(target);
  const cached = revisionQueueCache.get(key) as RevisionQueueResult | undefined;
  if (cached) return cached;

  const today = new Date();
  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);
  const sevenDaysAgo = new Date(today.getTime() - 7 * DAY_MS);

  const [pages, weakFlags, overrides, reviewedThisWeek] = await Promise.all([
    prisma.pageMemorization.findMany({
      where: { userId: target, status: { in: ['MEMORIZED', 'SOLID'] } },
      select: { page: true, status: true, lastReviewedAt: true, updatedAt: true },
    }),
    prisma.weakAyahFlag.findMany({
      where: { studentId: target, status: 'ACTIVE' },
      select: { ayah: { select: { page: true } } },
    }),
    prisma.revisionSchedule.findMany({
      where: { userId: target, status: 'PENDING', scheduledFor: { lte: endOfToday } },
      select: { surahId: true, scheduledFor: true },
    }),
    prisma.pageMemorization.count({ where: { userId: target, lastReviewedAt: { gte: sevenDaysAgo } } }),
  ]);

  const items = buildRevisionQueue({
    today,
    pages,
    weakPages: new Set(weakFlags.map((f) => f.ayah.page)),
    overrides,
  });

  const result: RevisionQueueResult = { items, reviewedThisWeek };
  revisionQueueCache.set(key, result, CACHE_TTL_MS);
  return result;
}
