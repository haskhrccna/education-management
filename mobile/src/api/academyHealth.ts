import { adminContracts } from '@quran-review/shared';
import { contractClient, expectStatus, API_ORIGIN } from './contract';

export interface TeacherLoadRow {
  teacherId: string;
  firstName: string;
  lastName: string;
  activeStudents: number;
}

export interface AcademyHealthMetrics {
  totalStudents: number;
  activeThisWeek: number;
  activeRatePct: number;
  pagesMemorizedThisWeek: number;
  revisionAdherencePct: number;
  atRiskCount: number;
  teacherLoad: TeacherLoadRow[];
  completionRatePct: number;
  generatedAt: string;
}

export const academyHealthApi = {
  async get(): Promise<AcademyHealthMetrics> {
    const res = await contractClient.call(adminContracts.getAcademyHealth, {});
    return expectStatus(res, 200).body as unknown as AcademyHealthMetrics;
  },
  /** ?token= pinned — an in-app/external browser open (WebBrowser.openBrowserAsync) cannot attach an Authorization header. */
  exportPdfUrl(token: string): string {
    return `${API_ORIGIN}/api/v1/files/academy-health.pdf?token=${encodeURIComponent(token)}`;
  },
};
