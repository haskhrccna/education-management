/**
 * Phase 5 (Gamification) — Mobile API client stub.
 *
 * Backend at GET /api/v1/gamification/me and GET /api/v1/gamification/leaderboard
 * is ready (see packages/server/src/services/gamification.service.ts). Mobile
 * wiring is intentionally deferred until the apiClient issue documented in
 * tasks/todo.md Phase 1 is resolved.
 *
 * Expected endpoints (typed stubs):
 *   GET  /api/v1/gamification/me
 *   GET  /api/v1/gamification/leaderboard?scope=all|teacher:<id>&limit=N
 */

export interface Streak {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null; // YYYY-MM-DD or null
}

export interface BadgeAward {
  code: string;
  name: string;
  description: string;
  iconKey: string;
  earnedAt: string;
}

export interface MyGamification {
  streak: Streak;
  badges: BadgeAward[];
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  currentStreak: number;
  longestStreak: number;
}

// TODO(Phase 5): wire to apiClient once the broken-typed-client issue (Phase 1
// task 1/2) is resolved. Until then this file exports the contract only.
