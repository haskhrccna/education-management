/**
 * Boot-time configuration contract.
 *
 * The production guards in config/index.ts are the difference between a
 * misconfigured deploy failing loudly at startup and a deployed API serving
 * broken links or rejecting every browser with a CORS error. They also caused
 * a real first-deploy failure on Render: PUBLIC_API_URL cannot be known before
 * the service exists, so the server refused to boot and the platform reported
 * it as a failed deploy. These tests pin both halves — the guards still fire,
 * and the platform-provided URL satisfies them.
 */
const BASE_ENV = {
  DATABASE_URL: 'postgresql://user:***@localhost:5432/db?schema=public',
  // Not one of the publicly-known test fixtures (those are production-blocked
  // in config/index.ts, and the test below asserts exactly that).
  JWT_SECRET: 'config-boot-suite-secret-xyz-0123456789-abcdefgh',
};

const loadConfig = (env: Record<string, string | undefined>) => {
  jest.resetModules();
  const previous = process.env;
  process.env = { ...BASE_ENV, ...env } as NodeJS.ProcessEnv;
  try {
    return require('../config').config;
  } finally {
    process.env = previous;
  }
};

describe('config boot guards', () => {
  it('refuses to start in production without CLIENT_URL', () => {
    expect(() => loadConfig({ NODE_ENV: 'production', PUBLIC_API_URL: 'https://api.example.com' })).toThrow(
      /CLIENT_URL/
    );
  });

  it('refuses to start in production with no public API URL from any source', () => {
    expect(() => loadConfig({ NODE_ENV: 'production', CLIENT_URL: 'https://example.github.io' })).toThrow(
      /PUBLIC_API_URL/
    );
  });

  it('accepts the URL the platform injects, so a first deploy can boot', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      CLIENT_URL: 'https://example.github.io',
      RENDER_EXTERNAL_URL: 'https://quran-review-api.onrender.com',
    });
    expect(config.publicApiUrl).toBe('https://quran-review-api.onrender.com');
  });

  it('prefers an explicit PUBLIC_API_URL — a custom domain must win over the platform default', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      CLIENT_URL: 'https://example.github.io',
      PUBLIC_API_URL: 'https://api.quranreview.app',
      RENDER_EXTERNAL_URL: 'https://quran-review-api.onrender.com',
    });
    expect(config.publicApiUrl).toBe('https://api.quranreview.app');
  });

  it('still rejects a placeholder JWT secret in production', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        CLIENT_URL: 'https://example.github.io',
        RENDER_EXTERNAL_URL: 'https://quran-review-api.onrender.com',
        JWT_SECRET: 'super-secret-jwt-key-change-in-production-minimum-32-characters-long',
      })
    ).toThrow(/placeholder/);
  });

  it('refuses the publicly-known test fixture secrets in production', () => {
    // These values are committed to a public repo (test suites + the M0 plan
    // doc) and therefore cannot be trusted as production secrets.
    const publicFixtures = [
      'a-test-secret-key-that-is-long-enough-32',
      'integration-test-secret-0123456789abcdef0123456789abcdef',
      'test-secret-key-for-ci-only-min-32-characters',
    ];
    for (const fixture of publicFixtures) {
      expect(() =>
        loadConfig({
          NODE_ENV: 'production',
          CLIENT_URL: 'https://example.github.io',
          RENDER_EXTERNAL_URL: 'https://quran-review-api.onrender.com',
          JWT_SECRET: fixture,
        })
      ).toThrow(/placeholder/);
    }
  });
});
