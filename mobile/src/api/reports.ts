import * as Linking from 'expo-linking';
import apiClient from './client';

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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  const g = globalThis as unknown as { btoa?: (s: string) => string };
  if (typeof g.btoa === 'function') {
    return g.btoa(binary);
  }
  // RN fallback: manual base64 encoder
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';
  for (let i = 0; i < binary.length; i += 3) {
    const b1 = binary.charCodeAt(i);
    const b2 = i + 1 < binary.length ? binary.charCodeAt(i + 1) : 0;
    const b3 = i + 2 < binary.length ? binary.charCodeAt(i + 2) : 0;
    const triplet = (b1 << 16) | (b2 << 8) | b3;
    output += chars[(triplet >> 18) & 0x3f];
    output += chars[(triplet >> 12) & 0x3f];
    output += i + 1 < binary.length ? chars[(triplet >> 6) & 0x3f] : '=';
    output += i + 2 < binary.length ? chars[triplet & 0x3f] : '=';
  }
  return output;
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

  /**
   * Downloads a report PDF using the authenticated client and opens it via Linking.
   * Falls back to opening the raw API URL if the data-URI approach is unsupported.
   */
  downloadReport: async (id: string): Promise<void> => {
    const res = await apiClient.get(`/files/reports/${id}`, {
      responseType: 'arraybuffer',
    });
    const base64 = arrayBufferToBase64(res.data as ArrayBuffer);
    const dataUri = `data:application/pdf;base64,${base64}`;
    const supported = await Linking.canOpenURL(dataUri).catch(() => false);
    if (supported) {
      await Linking.openURL(dataUri);
      return;
    }
    const baseURL = (apiClient.defaults.baseURL ?? '').replace(/\/$/, '');
    await Linking.openURL(`${baseURL}/files/reports/${id}`);
  },
};
