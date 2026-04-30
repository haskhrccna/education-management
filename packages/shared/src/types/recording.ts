export interface Recording {
  id: string;
  studentId: string;
  url: string;
  fileName: string;
  fileSizeBytes: number;
  contentType: string;
  previewImageUrl: string | null;
  reviewNotes: string | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  reviewedBy: string | null;
  createdAt: Date;
}

export interface CreateRecordingInput {
  fileName: string;
  fileSizeBytes: number;
  contentType: string;
}
