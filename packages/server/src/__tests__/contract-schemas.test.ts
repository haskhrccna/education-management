import {
  authContracts,
  healthContracts,
  contractRegistry,
  mediaContracts,
  communicationContracts,
  isRawResponse,
} from '@quran-review/shared';

describe('contract schemas pin current response shapes', () => {
  it('registry has 110 contracts with unique method+path', () => {
    expect(contractRegistry).toHaveLength(110);
    const keys = contractRegistry.map((c) => `${c.method} ${c.path}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('RecordingRow accepts the raw Prisma echo (incl. list student include)', () => {
    const observed = {
      id: 'c3a1e2d4-0000-4000-8000-000000000001',
      studentId: 'c3a1e2d4-0000-4000-8000-000000000002',
      url: '/uploads/uuid-test.mp3',
      fileName: 'test.mp3',
      fileSizeBytes: 4,
      contentType: 'audio/mpeg',
      previewImageUrl: null,
      reviewNotes: null,
      approvedAt: null,
      rejectedAt: null,
      reviewedBy: null,
      createdAt: '2026-07-10T00:00:00.000Z',
      updatedAt: '2026-07-10T00:00:00.000Z',
      accuracyScore: null,
      scoreStatus: 'PENDING',
      student: { id: 'c3a1e2d4-0000-4000-8000-000000000002', firstName: 'A', lastName: 'B', email: 'a@b.c' },
    };
    expect(() => mediaContracts.uploadRecording.responses[201].parse(observed)).not.toThrow();
    expect(() => mediaContracts.listRecordings.responses[200].parse([observed])).not.toThrow();
  });

  it('listMessages 200 union accepts BOTH pinned shapes (dual response)', () => {
    const summary = [
      {
        partner: { id: 'u-1', firstName: 'A', lastName: 'B' },
        lastMessage: {
          id: 'm-1',
          content: 'salam',
          type: 'TEXT',
          createdAt: '2026-07-10T00:00:00.000Z',
          readAt: null,
          sentByMe: false,
        },
        unreadCount: 1,
      },
    ];
    const raw = [
      {
        id: 'm-1',
        senderId: 'u-1',
        receiverId: 'u-2',
        type: 'TEXT',
        content: 'salam',
        attachmentUrl: null,
        readAt: null,
        createdAt: '2026-07-10T00:00:00.000Z',
        sender: { id: 'u-1', firstName: 'A', lastName: 'B' },
      },
    ];
    const schema = communicationContracts.listMessages.responses[200];
    expect(() => schema.parse(summary)).not.toThrow();
    expect(() => schema.parse(raw)).not.toThrow();
  });

  it('reviewRecording deliberately declares no request body (legacy had no validation)', () => {
    expect(mediaContracts.reviewRecording.request).toBeUndefined();
  });

  it('file downloads use headerOrQueryToken auth and raw 200s; exports are raw text/csv', () => {
    expect(mediaContracts.downloadRecordingFile.authVia).toBe('headerOrQueryToken');
    expect(mediaContracts.downloadReportFile.authVia).toBe('headerOrQueryToken');
    expect(mediaContracts.downloadCertificateFile.authVia).toBe('headerOrQueryToken');
    expect(isRawResponse(mediaContracts.downloadRecordingFile.responses[200])).toBe(true);
    expect(isRawResponse(mediaContracts.exportGrades.responses[200])).toBe(true);
    expect(mediaContracts.exportGrades.responses[200].contentType).toBe('text/csv');
  });

  it('login 200 schema accepts the observed login body', () => {
    const observed = {
      message: 'Login successful',
      user: {
        id: '9dfad50c-57bb-4a1b-bf1e-98ddbbb9db29',
        email: 'itest-student-1@itest.local',
        role: 'student',
        firstName: 'Itest',
        lastName: 'STUDENT',
        status: 'active',
      },
      token: 'x.y.z',
      refreshToken: 'a'.repeat(64),
    };
    expect(() => authContracts.login.responses[200].parse(observed)).not.toThrow();
  });

  it('register 201 schema requires UPPERCASE role/status (raw Prisma echo)', () => {
    const observed = {
      message: 'Registration successful. Awaiting admin approval.',
      user: {
        id: '9dfad50c-57bb-4a1b-bf1e-98ddbbb9db29',
        email: 'new@itest.local',
        role: 'STUDENT',
        firstName: 'A',
        lastName: 'B',
        status: 'PENDING',
      },
    };
    expect(() => authContracts.register.responses[201].parse(observed)).not.toThrow();
    expect(() =>
      authContracts.register.responses[201].parse({
        ...observed,
        user: { ...observed.user, role: 'student' },
      })
    ).toThrow();
  });

  it('health 200 schema accepts the observed health envelope', () => {
    const observed = {
      success: true,
      data: {
        status: 'healthy',
        timestamp: '2026-07-05T00:00:00.000Z',
        version: '1.0.0',
        checks: {
          database: { status: 'up', latencyMs: 3 },
          memory: { status: 'up', usedMB: 100, totalMB: 200 },
        },
      },
    };
    expect(() => healthContracts.getHealth.responses[200].parse(observed)).not.toThrow();
  });
});
