import * as WebBrowser from 'expo-web-browser';
import { mediaContracts } from '@quran-review/shared';
import apiClient from './client';
import { contractClient, expectStatus, API_ORIGIN } from './contract';
import { secureStorage } from '../storage/secureStorage';

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

  /**
   * S3 flow: presign the blob, PUT it straight to S3/MinIO, then call
   * /files/complete to create the Recording row. Falls back to the legacy
   * multipart POST when the server has STORAGE_ENABLED off (503 response).
   */
  upload: async (
    fileUri: string,
    fileName: string,
    fileSize: number,
    contentType: string,
    page?: number,
    surahId?: number
  ): Promise<Recording> => {
    try {
      return await recordingsApi.uploadViaS3(fileUri, fileName, fileSize, contentType, page, surahId);
    } catch (err: unknown) {
      const status =
        (err as { response?: { status?: number } })?.response?.status ?? (err as { status?: number })?.status;
      const message = (err as Error)?.message ?? '';
      // Only fall back on "server has storage disabled" — not on network/S3 errors.
      if (status === 503 || message.includes('Object storage is not enabled')) {
        const formData = new FormData();
        formData.append('file', { uri: fileUri, name: fileName, type: contentType } as unknown as Blob);
        formData.append('fileName', fileName);
        formData.append('fileSizeBytes', String(fileSize));
        formData.append('contentType', contentType);
        if (page != null) formData.append('page', String(page));
        if (surahId != null) formData.append('surahId', String(surahId));
        return recordingsApi.uploadRecording(formData);
      }
      throw err;
    }
  },

  uploadViaS3: async (
    fileUri: string,
    fileName: string,
    fileSize: number,
    contentType: string,
    page?: number,
    surahId?: number
  ): Promise<Recording> => {
    // 1) Presign
    const presign = expectStatus(
      await contractClient.call(mediaContracts.presignUpload, {
        body: { fileName, contentType, fileSizeBytes: fileSize, kind: 'recording' } as never,
      }),
      201
    );
    const { storageKey, uploadUrl } = presign.body as { storageKey: string; uploadUrl: string };

    // 2) PUT the blob (fetch handles file:// URIs in RN; web callers pass a blob URL)
    const fileResp = await fetch(fileUri);
    const blob = await fileResp.blob();
    const put = await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': contentType } });
    if (!put.ok) throw new Error(`S3 upload failed (${put.status})`);

    // 3) Complete → create the Recording row
    const complete = expectStatus(
      await contractClient.call(mediaContracts.completeUpload, {
        body: {
          storageKey,
          recording: {
            fileName,
            fileSizeBytes: fileSize,
            contentType,
            ...(page != null ? { page } : {}),
            ...(surahId != null ? { surahId } : {}),
          },
        } as never,
      }),
      200
    );
    return (complete.body as { recording: Recording }).recording;
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

  // HOLDOUT: browser download — the audio file opens in the system browser
  // with the pinned ?token= auth; no JSON transport involved. Mirrors
  // reportsApi.downloadReport exactly.
  downloadRecording: async (id: string): Promise<void> => {
    const token = (await secureStorage.getItem('auth_token')) ?? '';
    const url = `${API_ORIGIN}/api/v1/files/recordings/${id}?token=${encodeURIComponent(token)}`;
    await WebBrowser.openBrowserAsync(url);
  },
};
