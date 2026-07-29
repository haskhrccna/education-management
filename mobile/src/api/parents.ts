import { progressContracts, parentLinksContracts } from '@quran-review/shared';
import { contractClient, expectStatus } from './contract';

export type ParentLinkStatus = 'PENDING' | 'APPROVED' | 'DENIED';

export interface ParentLinkPerson {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface ParentLink {
  id: string;
  parentId: string;
  studentId: string;
  status: ParentLinkStatus;
  reason: string | null;
  requestedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  /** Present on the admin listing only (service includes parent+student for ADMIN). */
  parent?: ParentLinkPerson;
  /** Present on both listings. */
  student?: ParentLinkPerson;
}

export type GuardianConsentStatus = 'PENDING' | 'GRANTED' | 'DECLINED' | null;

export interface ChildSummary {
  linkId: string;
  linkedAt: string | null;
  digestOptOut: boolean;
  guardianConsentStatus: GuardianConsentStatus;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    status: string;
  };
}

export interface ChildDashboard {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    status: string;
    createdAt: string;
    assignedTeacher: { id: string; firstName: string; lastName: string } | null;
  };
  memorization: Array<{
    id: string;
    surah: { number: number; nameAr: string; nameEn: string };
    status: string;
    memorizedAyahs: number;
  }>;
  grades: Array<{
    id: string;
    grade: string;
    type: string;
    createdAt: string;
    surah?: { nameAr: string; nameEn: string };
  }>;
  attendance: Array<{ id: string; status: string; recordedAt: string }>;
  upcomingAppointments: Array<{
    id: string;
    requestedDate: string;
    requestedTime: string;
    teacher: { firstName: string; lastName: string };
  }>;
  pendingRevisions: Array<{
    id: string;
    scheduledFor: string;
    status: string;
    surah?: { nameAr: string; nameEn: string };
  }>;
  streak: { currentStreak: number; longestStreak: number };
}

export interface ParentChildReport {
  id: string;
  teacherId: string;
  studentId: string;
  pdfUrl: string;
  summary: string;
  generatedAt: string;
}

export interface ParentChildRecording {
  id: string;
  studentId: string;
  url: string;
  fileName: string;
  fileSizeBytes: number;
  contentType: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
}

export interface StudentSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export const parentsApi = {
  listLinks: async (): Promise<ParentLink[]> => {
    const res = expectStatus(await contractClient.call(progressContracts.listParentLinks), 200);
    return (res.body as unknown as { data: ParentLink[] }).data;
  },
  /**
   * ADMIN-only. The server validates `action` manually (not via zod), so an
   * invalid action returns 400 with a pinned message.
   */
  decideLink: async (linkId: string, action: 'APPROVE' | 'DENY', note?: string): Promise<ParentLink> => {
    const res = expectStatus(
      await contractClient.call(progressContracts.decideParentLink, {
        params: { id: linkId },
        body: { action, note } as never,
      }),
      200
    );
    return (res.body as unknown as { data: ParentLink }).data;
  },
  requestLink: async (studentId: string, reason?: string): Promise<ParentLink> => {
    const res = expectStatus(
      await contractClient.call(progressContracts.requestParentLink, { body: { studentId, reason } as never }),
      201
    );
    return (res.body as unknown as { data: ParentLink }).data;
  },
  searchStudent: async (email: string): Promise<StudentSearchResult> => {
    const res = expectStatus(
      await contractClient.call(progressContracts.parentStudentSearch, { query: { email } as never }),
      200
    );
    return (res.body as unknown as { data: StudentSearchResult }).data;
  },
  listChildren: async (): Promise<ChildSummary[]> => {
    const res = expectStatus(await contractClient.call(progressContracts.parentChildren), 200);
    return (res.body as unknown as { data: ChildSummary[] }).data;
  },
  setDigestPreference: async (linkId: string, digestOptOut: boolean): Promise<{ digestOptOut: boolean }> => {
    const res = expectStatus(
      await contractClient.call(parentLinksContracts.setDigestPreference, {
        params: { id: linkId },
        body: { digestOptOut } as never,
      }),
      200
    );
    // Fidelity: the axios version returned the whole response body.
    return res.body as unknown as { digestOptOut: boolean };
  },
  decideConsent: async (
    linkId: string,
    granted: boolean
  ): Promise<{ guardianConsentStatus: GuardianConsentStatus }> => {
    const res = expectStatus(
      await contractClient.call(parentLinksContracts.decideConsent, {
        params: { id: linkId },
        body: { granted } as never,
      }),
      200
    );
    // Fidelity: the axios version returned the whole response body.
    return res.body as unknown as { guardianConsentStatus: GuardianConsentStatus };
  },
  getChildDashboard: async (studentId: string): Promise<ChildDashboard> => {
    const res = expectStatus(
      await contractClient.call(progressContracts.childDashboard, { params: { studentId } }),
      200
    );
    return (res.body as unknown as { data: ChildDashboard }).data;
  },
  getChildReports: async (studentId: string): Promise<ParentChildReport[]> => {
    const res = expectStatus(
      await contractClient.call(progressContracts.parentChildReports, { params: { studentId } }),
      200
    );
    return (res.body as unknown as { data: ParentChildReport[] }).data;
  },
  getChildRecordings: async (studentId: string): Promise<ParentChildRecording[]> => {
    const res = expectStatus(
      await contractClient.call(progressContracts.parentChildRecordings, { params: { studentId } }),
      200
    );
    return (res.body as unknown as { data: ParentChildRecording[] }).data;
  },
};
