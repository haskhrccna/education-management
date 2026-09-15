/**
 * Unit tests for the S3-compatible shared media layer:
 * POST /api/v1/files/presign + POST /api/v1/files/complete.
 */
import request from 'supertest';

// jest.config maps '@edu/shared' but the contracts import '@quran-review/shared' —
// that resolves through the workspace symlink, which is fine here.

jest.mock('../services/storage.service', () => {
  return {
    isStorageEnabled: jest.fn().mockReturnValue(true),
    presignUpload: jest.fn().mockResolvedValue({
      storageKey: 'recordings/u1/key.m4a',
      uploadUrl: 'https://minio:9000/bucket/recordings/u1/key.m4a?sig=x',
      headers: undefined,
      expiresInSeconds: 900,
    }),
    completeUpload: jest.fn().mockResolvedValue({ url: 'recordings/u1/key.m4a', fileSizeBytes: 1234 }),
    removeObject: jest.fn().mockResolvedValue(undefined),
    streamObject: jest.fn(),
  };
});

jest.mock('../services/recording.service', () => {
  const actual = jest.requireActual('../services/recording.service');
  return { ...actual, completeRecordingUpload: jest.fn() };
});

// Bypass auth to focus on contract shape + service wiring.
jest.mock('../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.userId = 'student-1';
    req.userRole = 'STUDENT';
    next();
  },
  authorize: () => (_req: any, _res: any, next: any) => next(),
  fileAuthenticate: (req: any, _res: any, next: any) => {
    req.userId = 'student-1';
    req.userRole = 'STUDENT';
    next();
  },
}));

// setup.ts (setupFilesAfterEach) already mocks prisma + lib/queue globally.
import * as storageService from '../services/storage.service';
import * as recordingService from '../services/recording.service';

describe('files S3 media layer', () => {
  let app: ReturnType<typeof import('express')>;

  beforeAll(async () => {
    const mod = await import('../app');
    app = mod.default as any;
  });

  beforeEach(() => jest.clearAllMocks());

  it('POST /api/v1/files/presign returns 201 with a storageKey + uploadUrl', async () => {
    const res = await request(app)
      .post('/api/v1/files/presign')
      .send({ fileName: 'rec.m4a', contentType: 'audio/x-m4a', fileSizeBytes: 1234 });

    expect(res.status).toBe(201);
    expect(res.body.storageKey).toBe('recordings/u1/key.m4a');
    expect(res.body.uploadUrl).toContain('https://');
    expect(storageService.presignUpload).toHaveBeenCalledWith('recordings/student-1', 'rec.m4a', 'audio/x-m4a', 1234);
  });

  it('POST /api/v1/files/complete without recording metadata is rejected with 400', async () => {
    const res = await request(app).post('/api/v1/files/complete').send({ storageKey: 'recordings/u1/key.m4a' });

    expect(res.status).toBe(400);
    expect(recordingService.completeRecordingUpload).not.toHaveBeenCalled();
  });

  it('POST /api/v1/files/complete with recording metadata creates the Recording row', async () => {
    (recordingService.completeRecordingUpload as jest.Mock).mockResolvedValue({
      id: 'rec-1',
      studentId: 'student-1',
      url: 'recordings/u1/key.m4a',
      fileName: 'rec.m4a',
      fileSizeBytes: 1234,
      contentType: 'audio/x-m4a',
      reviewNotes: null,
      approvedAt: null,
      rejectedAt: null,
      createdAt: new Date().toISOString(),
    });

    const res = await request(app)
      .post('/api/v1/files/complete')
      .send({
        storageKey: 'recordings/u1/key.m4a',
        recording: { fileName: 'rec.m4a', fileSizeBytes: 1234, contentType: 'audio/x-m4a' },
      });

    expect(res.status).toBe(200);
    expect(res.body.recording.id).toBe('rec-1');
    expect(res.body.url).toBe('recordings/u1/key.m4a');
    expect(recordingService.completeRecordingUpload).toHaveBeenCalledWith(
      'student-1',
      'recordings/u1/key.m4a',
      'rec.m4a',
      1234,
      'audio/x-m4a',
      undefined,
      undefined
    );
  });

  it('returns 503 when STORAGE_ENABLED is off', async () => {
    (storageService.isStorageEnabled as jest.Mock).mockReturnValueOnce(false);
    const res = await request(app)
      .post('/api/v1/files/presign')
      .send({ fileName: 'rec.m4a', contentType: 'audio/x-m4a' });
    expect(res.status).toBe(503);
  });
});
