import apiClient from './client';

export type RecordingStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Recording {
  id: string;
  studentId: string;
  url: string;
  fileName: string;
  fileSizeBytes: number;
  contentType: string;
  reviewNotes?: string | null;
  reviewedBy?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  createdAt: string;
  accuracyScore?: number | null;
  scoreStatus?: 'PENDING' | 'SCORED' | 'UNAVAILABLE';
  student?: { id: string; firstName: string; lastName: string; email: string };
}

export interface RecordingListParams {
  page?: number;
  pageSize?: number;
}

export interface ReviewRecordingBody {
  approved: boolean;
  notes?: string;
}

export const getRecordingStatus = (recording: Recording): RecordingStatus => {
  if (recording.approvedAt) return 'APPROVED';
  if (recording.rejectedAt) return 'REJECTED';
  return 'PENDING';
};

export const recordingsApi = {
  list: async (params?: RecordingListParams): Promise<Recording[]> => {
    const res = await apiClient.get('/recordings', { params });
    return res.data;
  },

  // Alias matching task naming
  getRecordings: async (params?: RecordingListParams): Promise<Recording[]> => {
    const res = await apiClient.get('/recordings', { params });
    return res.data;
  },

  uploadRecording: async (formData: FormData): Promise<Recording> => {
    const res = await apiClient.post('/recordings', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: (data) => data,
    });
    return res.data;
  },

  // Legacy uri-based helper for callers that don't already have a FormData
  upload: async (fileUri: string, fileName: string, fileSize: number, contentType: string): Promise<Recording> => {
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      name: fileName,
      type: contentType,
    } as unknown as Blob);
    formData.append('fileName', fileName);
    formData.append('fileSizeBytes', String(fileSize));
    formData.append('contentType', contentType);
    return recordingsApi.uploadRecording(formData);
  },

  reviewRecording: async (id: string, body: ReviewRecordingBody): Promise<Recording> => {
    const res = await apiClient.put(`/recordings/${id}`, body);
    return res.data;
  },

  deleteRecording: async (id: string): Promise<{ message: string }> => {
    const res = await apiClient.delete(`/recordings/${id}`);
    return res.data;
  },
};
