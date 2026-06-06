import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

// gamification service calls notifyUser internally (best-effort). Stub
// the downstream services it dynamically imports.
jest.mock('../../services/socket.service', () => ({ sendToUser: jest.fn() }));
jest.mock('../../services/email.service', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../services/fcm.service', () => ({ sendPushToUser: jest.fn().mockResolvedValue(undefined) }));

import { prisma } from '../../prisma/client';
import {
  classifyStreakUpdate,
  recordActivity,
  awardBadge,
  evaluateMilestones,
  getMyGamification,
  getLeaderboard,
} from '../gamification.service';

const m = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('gamification.service', () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── classifyStreakUpdate (pure) ────────────────────────────────────────

  describe('classifyStreakUpdate', () => {
    it('first-ever call → "first"', () => {
      expect(classifyStreakUpdate(null, new Date('2026-06-06T10:00:00Z'))).toBe('first');
    });

    it('same UTC day → "same-day"', () => {
      const prev = { lastActiveDate: new Date('2026-06-06T03:00:00Z'), currentStreak: 5 };
      expect(classifyStreakUpdate(prev, new Date('2026-06-06T22:00:00Z'))).toBe('same-day');
    });

    it('exactly +1 day → "consec"', () => {
      const prev = { lastActiveDate: new Date('2026-06-05T20:00:00Z'), currentStreak: 5 };
      expect(classifyStreakUpdate(prev, new Date('2026-06-06T03:00:00Z'))).toBe('consec');
    });

    it('+2 days → "reset"', () => {
      const prev = { lastActiveDate: new Date('2026-06-04T10:00:00Z'), currentStreak: 5 };
      expect(classifyStreakUpdate(prev, new Date('2026-06-06T10:00:00Z'))).toBe('reset');
    });

    it('a week later → "reset"', () => {
      const prev = { lastActiveDate: new Date('2026-05-30T10:00:00Z'), currentStreak: 5 };
      expect(classifyStreakUpdate(prev, new Date('2026-06-06T10:00:00Z'))).toBe('reset');
    });
  });

  // ─── recordActivity ────────────────────────────────────────────────────

  describe('recordActivity', () => {
    it('first-ever activity creates a streak row at current=1, longest=1', async () => {
      m.streak.findUnique.mockResolvedValue(null);
      m.streak.upsert.mockResolvedValue({
        userId: 'student-1',
        currentStreak: 1,
        longestStreak: 1,
        lastActiveDate: new Date('2026-06-06T00:00:00Z'),
      });

      const result = await recordActivity('student-1', new Date('2026-06-06T10:00:00Z'));

      expect(result.outcome).toBe('first');
      expect(result.currentStreak).toBe(1);
      expect(result.longestStreak).toBe(1);
      expect(m.streak.upsert).toHaveBeenCalledTimes(1);
    });

    it('same-day second call is a no-op (no upsert)', async () => {
      m.streak.findUnique.mockResolvedValue({
        userId: 'student-1',
        currentStreak: 3,
        longestStreak: 5,
        lastActiveDate: new Date('2026-06-06T00:00:00Z'),
      } as any);

      const result = await recordActivity('student-1', new Date('2026-06-06T20:00:00Z'));

      expect(result.outcome).toBe('same-day');
      expect(m.streak.upsert).not.toHaveBeenCalled();
    });

    it('consecutive day bumps current and bumps longest when it exceeds it', async () => {
      m.streak.findUnique.mockResolvedValue({
        userId: 'student-1',
        currentStreak: 5,
        longestStreak: 5,
        lastActiveDate: new Date('2026-06-05T00:00:00Z'),
      } as any);
      m.streak.upsert.mockResolvedValue({
        userId: 'student-1',
        currentStreak: 6,
        longestStreak: 6,
        lastActiveDate: new Date('2026-06-06T00:00:00Z'),
      });

      const result = await recordActivity('student-1', new Date('2026-06-06T10:00:00Z'));

      expect(result.outcome).toBe('consec');
      expect(result.currentStreak).toBe(6);
      // longest was 5, current now 6 → longest=6
      expect(m.streak.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ currentStreak: 6, longestStreak: 6 }),
        })
      );
    });

    it('gap of 2+ days resets to 1 but preserves longest', async () => {
      m.streak.findUnique.mockResolvedValue({
        userId: 'student-1',
        currentStreak: 10,
        longestStreak: 10,
        lastActiveDate: new Date('2026-06-01T00:00:00Z'),
      } as any);
      m.streak.upsert.mockResolvedValue({
        userId: 'student-1',
        currentStreak: 1,
        longestStreak: 10,
        lastActiveDate: new Date('2026-06-06T00:00:00Z'),
      });

      const result = await recordActivity('student-1', new Date('2026-06-06T10:00:00Z'));

      expect(result.outcome).toBe('reset');
      expect(result.currentStreak).toBe(1);
      expect(result.longestStreak).toBe(10);
    });
  });

  // ─── awardBadge (idempotent) ───────────────────────────────────────────

  describe('awardBadge', () => {
    it('returns existing award without creating a duplicate', async () => {
      m.badge.findUnique.mockResolvedValue({ id: 'badge_first_surah' } as any);
      m.userBadge.findUnique.mockResolvedValue({
        id: 'ub-1',
        userId: 'student-1',
        badgeId: 'badge_first_surah',
        earnedAt: new Date(),
      } as any);

      const result = await awardBadge('student-1', 'first_surah_memorized');

      expect(result.newlyAwarded).toBe(false);
      expect(m.userBadge.create).not.toHaveBeenCalled();
      // No badge_earned notification on idempotent hits
      expect(m.notification.create).not.toHaveBeenCalled();
    });

    it('first award creates the row and fires a notification', async () => {
      m.badge.findUnique.mockResolvedValue({
        id: 'badge_first_surah',
        code: 'first_surah_memorized',
        name: 'First Surah',
        description: 'Memorized your first surah',
        iconKey: 'star',
      } as any);
      m.userBadge.findUnique.mockResolvedValue(null);
      m.userBadge.create.mockResolvedValue({
        id: 'ub-2',
        userId: 'student-1',
        badgeId: 'badge_first_surah',
        earnedAt: new Date(),
        badge: { code: 'first_surah_memorized', name: 'First Surah' },
      } as any);

      const result = await awardBadge('student-1', 'first_surah_memorized');

      expect(result.newlyAwarded).toBe(true);
      expect(m.userBadge.create).toHaveBeenCalledWith({
        data: { userId: 'student-1', badgeId: 'badge_first_surah' },
        include: { badge: true },
      });
      expect(m.notification.create.mock.calls[0][0].data.type).toBe('badge_earned');
    });
  });

  // ─── evaluateMilestones ────────────────────────────────────────────────

  describe('evaluateMilestones', () => {
    it('awards first_surah_memorized when at least one surah is COMPLETE', async () => {
      m.streak.findUnique.mockResolvedValue({ currentStreak: 0 } as any);
      m.memorizationProgress.count.mockResolvedValueOnce(1); // completedSurahs
      m.revisionSchedule.count.mockResolvedValueOnce(0); // completedRevisions
      m.memorizationProgress.findMany.mockResolvedValue([] as any); // distinctSurahs
      m.badge.findUnique.mockResolvedValue({ id: 'badge_first_surah' } as any);
      m.userBadge.findUnique.mockResolvedValue(null);
      m.userBadge.create.mockResolvedValue({} as any);

      const result = await evaluateMilestones('student-1');

      const codes = result.map((r) => r.code);
      expect(codes).toContain('first_surah_memorized');
    });

    it('awards first_revision_completed when at least one revision is COMPLETED', async () => {
      m.streak.findUnique.mockResolvedValue({ currentStreak: 0 } as any);
      m.memorizationProgress.count.mockResolvedValueOnce(0); // completedSurahs
      m.revisionSchedule.count.mockResolvedValueOnce(1); // completedRevisions
      m.memorizationProgress.findMany.mockResolvedValue([] as any);
      m.badge.findUnique.mockResolvedValue({ id: 'badge_first_review' } as any);
      m.userBadge.findUnique.mockResolvedValue(null);
      m.userBadge.create.mockResolvedValue({} as any);

      const result = await evaluateMilestones('student-1');

      const codes = result.map((r) => r.code);
      expect(codes).toContain('first_revision_completed');
    });

    it('awards streak_7 when current streak is 7', async () => {
      m.streak.findUnique.mockResolvedValue({ currentStreak: 7 } as any);
      m.memorizationProgress.count.mockResolvedValue(0);
      m.revisionSchedule.count.mockResolvedValue(0);
      m.memorizationProgress.findMany.mockResolvedValue([] as any);
      m.badge.findUnique.mockResolvedValue({ id: 'badge_streak_7' } as any);
      m.userBadge.findUnique.mockResolvedValue(null);
      m.userBadge.create.mockResolvedValue({} as any);

      const result = await evaluateMilestones('student-1');

      const codes = result.map((r) => r.code);
      expect(codes).toContain('streak_7');
    });

    it('does not award streak_7 when current streak is 6 and no other conditions met', async () => {
      m.streak.findUnique.mockResolvedValue({ currentStreak: 6 } as any);
      m.memorizationProgress.count.mockResolvedValue(0);
      m.revisionSchedule.count.mockResolvedValue(0);
      m.memorizationProgress.findMany.mockResolvedValue([] as any);

      const result = await evaluateMilestones('student-1');

      expect(result).toHaveLength(0);
    });
  });

  // ─── getMyGamification ─────────────────────────────────────────────────

  describe('getMyGamification', () => {
    it('returns empty defaults when no streak row exists', async () => {
      m.streak.findUnique.mockResolvedValue(null);
      m.userBadge.findMany.mockResolvedValue([]);

      const data = await getMyGamification('student-1');

      expect(data.streak).toEqual({
        userId: 'student-1',
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: null,
      });
      expect(data.badges).toEqual([]);
    });
  });

  // ─── getLeaderboard ────────────────────────────────────────────────────

  describe('getLeaderboard', () => {
    it('with no scope returns all students ordered by streak desc', async () => {
      m.streak.findMany.mockResolvedValue([
        { userId: 's1', currentStreak: 10, longestStreak: 10, user: { id: 's1', firstName: 'A', lastName: 'A' } },
        { userId: 's2', currentStreak: 5, longestStreak: 7, user: { id: 's2', firstName: 'B', lastName: 'B' } },
      ] as any);

      const board = await getLeaderboard('all', 10);

      expect(board).toHaveLength(2);
      expect(board[0].rank).toBe(1);
      expect(board[0].userId).toBe('s1');
      expect(board[0].name).toBe('A A');
    });

    it("with teacher:<id> scope filters to that teacher's students", async () => {
      m.appointment.findMany.mockResolvedValue([{ studentId: 's1' }] as any);
      m.streak.findMany.mockResolvedValue([
        { userId: 's1', currentStreak: 3, longestStreak: 3, user: { id: 's1', firstName: 'X', lastName: 'Y' } },
      ] as any);

      await getLeaderboard('teacher:teacher-1', 10);

      expect(m.streak.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: { in: ['s1'] } },
        })
      );
    });

    it('returns empty array when teacher has no students with streaks', async () => {
      m.appointment.findMany.mockResolvedValue([] as any);

      const board = await getLeaderboard('teacher:teacher-1', 10);

      expect(board).toEqual([]);
      expect(m.streak.findMany).not.toHaveBeenCalled();
    });
  });
});
