import * as WebBrowser from 'expo-web-browser';
import apiClient from './client';
import { useAuthStore } from '../auth/store';

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
    const res = await apiClient.get('/reports', { params });
    return res.data;
  },

  createReport: async (input: CreateReportInput): Promise<Report> => {
    const summary = input.period ? `[${input.period}] ${input.notes || ''}`.trim() : input.notes;
    const res = await apiClient.post('/reports', {
      studentId: input.studentId,
      summary,
    });
    return res.data;
  },

  downloadReport: async (id: string): Promise<void> => {
    const token = useAuthStore.getState().token ?? '';
    const baseURL = (apiClient.defaults.baseURL ?? '').replace(/\/$/, '');
    const url = `${baseURL}/files/reports/${id}?token=${encodeURIComponent(token)}`;
    await WebBrowser.openBrowserAsync(url);
  },
};
