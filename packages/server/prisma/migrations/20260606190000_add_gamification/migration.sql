-- Phase 5: Gamification — streaks, badges, leaderboard.
--
-- Three new tables:
--   streaks     — 1:1 with users; current/longest streak + last active date
--   badges      — global catalog (seeded below)
--   user_badges — idempotent award log; UNIQUE(userId, badgeId) lets
--                 evaluateMilestones run on every activity without dupes

CREATE TABLE "streaks" (
  "userId"         TEXT PRIMARY KEY,
  "currentStreak"  INTEGER         NOT NULL DEFAULT 0,
  "longestStreak"  INTEGER         NOT NULL DEFAULT 0,
  "lastActiveDate" DATE            NOT NULL,
  CONSTRAINT "streaks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX "streaks_currentStreak_idx" ON "streaks"("currentStreak" DESC);

CREATE TABLE "badges" (
  "id"          TEXT PRIMARY KEY,
  "code"        TEXT NOT NULL UNIQUE,
  "name"        TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "iconKey"     TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "user_badges" (
  "id"        TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL,
  "badgeId"   TEXT NOT NULL,
  "earnedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_badges_userId_fkey"  FOREIGN KEY ("userId")  REFERENCES "users"("id")   ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "user_badges_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "badges"("id")  ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE UNIQUE INDEX "user_badges_userId_badgeId_key" ON "user_badges"("userId", "badgeId");
CREATE INDEX        "user_badges_userId_earnedAt_idx" ON "user_badges"("userId", "earnedAt" DESC);

-- ─── Seed the badge catalog (idempotent: only inserts if a code is missing) ──

INSERT INTO "badges" ("id", "code", "name", "description", "iconKey") VALUES
  ('badge_first_surah',   'first_surah_memorized',   'First Surah',     'Memorized your first surah',          'star'),
  ('badge_first_review',  'first_revision_completed', 'First Revision', 'Completed your first revision',       'check'),
  ('badge_juz_one',       'juz_complete',            'Juz Complete',    'Completed 30 surahs',                 'book'),
  ('badge_streak_7',      'streak_7',                '7-Day Streak',    'Active for 7 days in a row',          'flame'),
  ('badge_streak_30',     'streak_30',               '30-Day Streak',   'Active for 30 days in a row',         'flame-strong')
ON CONFLICT ("code") DO NOTHING;
