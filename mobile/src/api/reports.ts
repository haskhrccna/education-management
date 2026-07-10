import * as WebBrowser from 'expo-web-browser';
import { mediaContracts } from '@quran-review/shared';
import { contractClient, expectStatus, API_ORIGIN } from './contract';
import { secureStorage } from '../storage/secureStorage';

export interface Report {
  id: string;
  teacherId: string;
  studentId: string;
  pdfUrl: string;
  generatedAt: string;
  summary: string;
  teacher?: { id: string; firstName: string; lastName: string; email: string };
  student?: { id: string; firstName: string; lastName: string; email: string };
}

export interface CreateReportInput {
  studentId: string;
  /** Period label (e.g. "Q1 2026", "Ramadan", "March"). Persisted into summary alongside notes. */
  period: string;
  notes: string;
}

export const reportsApi = {
  getReports: async (params?: { studentId?: string }): Promise<Report[]> => {
    const res = expectStatus(
      await contractClient.call(mediaContracts.listReports, {
        query: params?.studentId ? ({ studentId: params.studentId } as never) : undefined,
      }),
      200
    );
    return res.body as unknown as Report[];
  },

  createReport: async (input: CreateReportInput): Promise<Report> => {
    const summary = input.period ? `[${input.period}] ${input.notes || ''}`.trim() : input.notes;
    const res = expectStatus(
      await contractClient.call(mediaContracts.generateReport, {
        body: { studentId: input.studentId, summary } as never,
      }),
      201
    );
    return res.body as unknown as Report;
  },

  // HOLDOUT: browser download — the PDF opens in the system browser with the
  // pinned ?token= auth; no JSON transport involved.
  downloadReport: async (id: string): Promise<void> => {
    const token = (await secureStorage.getItem('auth_token')) ?? '';
    const url = `${API_ORIGIN}/api/v1/files/reports/${id}?token=${encodeURIComponent(token)}`;
    await WebBrowser.openBrowserAsync(url);
  },
};
