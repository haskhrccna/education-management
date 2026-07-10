import { progressContracts } from '@quran-review/shared';
import * as analyticsService from '../../services/analytics.service';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const adminAnalytics = defineRoute(progressContracts.adminAnalytics, async () => {
  const [surahMissRates, teacherLoad, weeklyActiveStudents] = await Promise.all([
    analyticsService.getSurahMissRates(),
    analyticsService.getTeacherLoadDistribution(),
    analyticsService.getWeeklyActiveStudents(),
  ]);
  return {
    status: 200 as const,
    body: { success: true as const, data: { surahMissRates, teacherLoad, weeklyActiveStudents } },
  };
});

export const analyticsRouter = buildContractRouter([adminAnalytics], { mountPrefix: '/api/v1/analytics' });
