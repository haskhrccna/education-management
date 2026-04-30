import apiClient from './client';

export interface Recording {
  id: string;
  studentId: string;
  url: string;
  fileName: string;
  fileSizeBytes: number;
  contentType: string;
  reviewNotes?: string;
  approvedAt?: string;
  rejectedAt?: string;
  createdAt: string;
  student?: { id: string; firstName: string; lastName: string; email: string };
}

export const recordingsApi = {
  list: async (): Promise<Recording[]> => {
    const res = await apiClient.get('/recordings');
    return res.data;
  },

  upload: async (fileUri: string, fileName: string, fileSize: number, contentType: string) => {
    const res = await apiClient.post('/recordings', {
      fileName,
      fileSizeBytes: fileSize,
      contentType,
    });
    return res.data;
  },
};
