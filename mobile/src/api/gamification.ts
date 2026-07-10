import { progressContracts } from '@quran-review/shared';
import { contractClient, expectStatus } from './contract';

export interface Streak {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
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

export const gamificationApi = {
  getMine: async (): Promise<MyGamification> => {
    const res = expectStatus(await contractClient.call(progressContracts.gamificationMe), 200);
    return (res.body as unknown as { data: MyGamification }).data;
  },
  getLeaderboard: async (scope?: string, limit = 20): Promise<LeaderboardEntry[]> => {
    const res = expectStatus(
      await contractClient.call(progressContracts.leaderboard, { query: { scope, limit } }),
      200
    );
    return (res.body as unknown as { data: LeaderboardEntry[] }).data;
  },
};
