import { progressContracts } from '@quran-review/shared';
import { contractClient, expectStatus } from './contract';

export interface SurahMissRate {
  surah: { id: number; number: number; nameAr: string; nameEn: string };
  missCount: number;
  totalAttempts: number;
  missRate: number;
}

export interface TeacherLoad {
  teacher: { id: string; firstName: string; lastName: string; email: string };
  activeStudents: number;
  gradesLast30d: number;
  sessionsLast30d: number;
}

export interface WeeklyActiveStudents {
  activeCount: number;
  totalStudents: number;
  activeRatePct: number;
}

export interface AdminAnalytics {
  surahMissRates: SurahMissRate[];
  teacherLoad: TeacherLoad[];
  weeklyActiveStudents: WeeklyActiveStudents;
}

export const analyticsApi = {
  getAdminAnalytics: async (): Promise<AdminAnalytics> => {
    const res = expectStatus(await contractClient.call(progressContracts.adminAnalytics), 200);
    return (res.body as unknown as { data: AdminAnalytics }).data;
  },
};
