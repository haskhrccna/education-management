import { mediaContracts } from '@quran-review/shared';
import apiClient from './client';
import { contractClient, expectStatus } from './contract';

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
  // Recite-from-the-page (F2): mushaf page / surah the recitation covers.
  page?: number | null;
  surahId?: number | null;
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
    const res = expectStatus(
      await contractClient.call(mediaContracts.listRecordings, {
        query: params ? (params as never) : undefined,
      }),
      200
    );
    return res.body as unknown as Recording[];
  },

  // Alias matching task naming
  getRecordings: async (params?: RecordingListParams): Promise<Recording[]> => {
    return recordingsApi.list(params);
  },

  // HOLDOUT: multipart upload — the contract client is JSON-only; multer parses
  // this on the server before validation (pinned ordering).
  uploadRecording: async (formData: FormData): Promise<Recording> => {
    const res = await apiClient.post('/recordings', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: (data) => data,
    });
    return res.data;
  },

  // Legacy uri-based helper for callers that don't already have a FormData
  upload: async (
    fileUri: string,
    fileName: string,
    fileSize: number,
    contentType: string,
    page?: number,
    surahId?: number
  ): Promise<Recording> => {
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      name: fileName,
      type: contentType,
    } as unknown as Blob);
    formData.append('fileName', fileName);
    formData.append('fileSizeBytes', String(fileSize));
    formData.append('contentType', contentType);
    if (page != null) formData.append('page', String(page));
    if (surahId != null) formData.append('surahId', String(surahId));
    return recordingsApi.uploadRecording(formData);
  },

  reviewRecording: async (id: string, body: ReviewRecordingBody): Promise<Recording> => {
    const res = expectStatus(
      await contractClient.call(mediaContracts.reviewRecording, {
        params: { id },
        body: body as never, // contract pins NO validation; body passes through untyped
      }),
      200
    );
    return res.body as unknown as Recording;
  },

  deleteRecording: async (id: string): Promise<{ message: string }> => {
    const res = expectStatus(await contractClient.call(mediaContracts.deleteRecording, { params: { id } }), 200);
    return res.body as unknown as { message: string };
  },
};
