import apiClient from './client';

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
    const res = await apiClient.get('/gamification/me');
    return res.data?.data ?? res.data;
  },
  getLeaderboard: async (scope?: string, limit = 20): Promise<LeaderboardEntry[]> => {
    const res = await apiClient.get('/gamification/leaderboard', { params: { scope, limit } });
    return res.data?.data ?? res.data;
  },
};
