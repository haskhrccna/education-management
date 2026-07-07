import apiClient from './client';

export type ParentLinkStatus = 'PENDING' | 'APPROVED' | 'DENIED';

export interface ParentLink {
  id: string;
  parentId: string;
  studentId: string;
  status: ParentLinkStatus;
  reason: string | null;
  requestedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
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
  student: { id: string; firstName: string; lastName: string; email: string; status: string; createdAt: string };
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
}

export interface StudentSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export const parentsApi = {
  listLinks: async (): Promise<ParentLink[]> => {
    const res = await apiClient.get('/parents/links');
    return res.data?.data ?? [];
  },
  requestLink: async (studentId: string, reason?: string): Promise<ParentLink> => {
    const res = await apiClient.post('/parents/links', { studentId, reason });
    return res.data?.data ?? res.data;
  },
  searchStudent: async (email: string): Promise<StudentSearchResult> => {
    const res = await apiClient.get('/parents/student-search', { params: { email } });
    return res.data?.data ?? res.data;
  },
  listChildren: async (): Promise<ChildSummary[]> => {
    const res = await apiClient.get('/parents/children');
    return res.data?.data ?? [];
  },
  setDigestPreference: async (linkId: string, digestOptOut: boolean): Promise<{ digestOptOut: boolean }> => {
    const res = await apiClient.patch(`/parent-links/${linkId}/digest-preference`, { digestOptOut });
    return res.data;
  },
  decideConsent: async (
    linkId: string,
    granted: boolean
  ): Promise<{ guardianConsentStatus: GuardianConsentStatus }> => {
    const res = await apiClient.patch(`/parent-links/${linkId}/consent`, { granted });
    return res.data;
  },
  getChildDashboard: async (studentId: string): Promise<ChildDashboard> => {
    const res = await apiClient.get(`/parents/children/${studentId}/dashboard`);
    return res.data?.data ?? res.data;
  },
};
