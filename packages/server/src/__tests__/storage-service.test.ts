/**
 * The real storage service (not a mock): the enabled flag and the host that
 * presigned upload URLs are signed for. Nothing here needs a running store —
 * the bucket check fails fast against a closed port and is best-effort.
 */
type StorageService = typeof import('../services/storage.service');

const loadWith = (env: Record<string, string | undefined>): StorageService => {
  const saved = { ...process.env };
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('STORAGE_')) delete process.env[key];
  }
  Object.assign(process.env, env);
  let mod!: StorageService;
  jest.isolateModules(() => {
    mod = require('../services/storage.service');
  });
  process.env = saved;
  return mod;
};

const base = {
  STORAGE_ENDPOINT: '127.0.0.1:1',
  STORAGE_ACCESS_KEY: 'unit-test-access',
  STORAGE_SECRET_KEY: 'unit-test-secret',
  STORAGE_BUCKET: 'unit-bucket',
};

describe('storage.service (unmocked)', () => {
  it('is enabled as soon as STORAGE_ENABLED=1, before any client exists', () => {
    expect(loadWith({ ...base, STORAGE_ENABLED: '1' }).isStorageEnabled()).toBe(true);
  });

  it('is disabled when STORAGE_ENABLED is unset or not exactly 1', () => {
    expect(loadWith(base).isStorageEnabled()).toBe(false);
    expect(loadWith({ ...base, STORAGE_ENABLED: 'true' }).isStorageEnabled()).toBe(false);
  });

  it('refuses to presign when disabled', async () => {
    await expect(loadWith(base).presignUpload('recordings/u1', 'a.m4a', 'audio/mp4')).rejects.toMatchObject({
      statusCode: 503,
    });
  });

  it('signs upload URLs for the public origin when one is configured', async () => {
    const env = { ...base, STORAGE_ENABLED: '1', STORAGE_PRESIGN_ENDPOINT_URL: 'https://media.example.test' };
    const saved = { ...process.env };
    Object.assign(process.env, env);
    try {
      const result = await loadWith(env).presignUpload('recordings/u1', 'a b.m4a', 'audio/mp4');
      const url = new URL(result.uploadUrl);
      expect(url.origin).toBe('https://media.example.test');
      expect(url.pathname.startsWith('/unit-bucket/recordings/u1/')).toBe(true);
      expect(url.searchParams.get('X-Amz-Signature')).toBeTruthy();
      expect(result.storageKey.endsWith('-a_b.m4a')).toBe(true);
    } finally {
      process.env = saved;
    }
  });
});
