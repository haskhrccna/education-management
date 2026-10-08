/**
 * initFCM against the real firebase-admin package.
 *
 * Every other test mocks fcm.service, so nothing exercised the initialization
 * path — and that path is wrapped in a try/catch that disables push and logs,
 * by design, because push is optional. The result: a firebase-admin major
 * upgrade could turn push off permanently and no test would fail. (It did:
 * v14 dropped `admin.credential` and `admin.messaging` from the CJS root
 * export, which is what the old code called.)
 *
 * This test calls the real thing with syntactically valid throwaway
 * credentials. initializeApp/getMessaging do no network I/O — delivery would,
 * and is not exercised here — so a green run means the API shape the service
 * depends on still exists in the installed version.
 */
import { generateKeyPairSync } from 'crypto';

// cert() parses the PEM, so this needs to be a real key — generated here at
// run time and thrown away with the process. Nothing signs with it, and no key
// material lands in the repository.
const THROWAWAY_KEY = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
}).privateKey as string;

describe('initFCM with the installed firebase-admin', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      FIREBASE_PROJECT_ID: 'test-project',
      FIREBASE_CLIENT_EMAIL: 'test@test-project.iam.gserviceaccount.com',
      FIREBASE_PRIVATE_KEY: THROWAWAY_KEY,
    };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('initializes without falling into the catch that disables push', async () => {
    // isolateModulesAsync so config/ and lib/logger are re-read with the env
    // above — and so the logger spied on here is the same instance the service
    // imports, which it is not after a bare jest.resetModules().
    await jest.isolateModulesAsync(async () => {
      const { logger } = await import('../../lib/logger');
      const errors: unknown[] = [];
      const infos: string[] = [];
      jest.spyOn(logger, 'error').mockImplementation(((...args: unknown[]) => {
        errors.push(args);
        return logger;
      }) as never);
      jest.spyOn(logger, 'info').mockImplementation(((...args: unknown[]) => {
        infos.push(args.map(String).join(' '));
        return logger;
      }) as never);

      const { initFCM } = await import('../fcm.service');
      await initFCM();

      // The failure mode this test exists for: init throws, the catch logs
      // 'FCM init failed' and sets messaging = null, and push is silently off.
      expect(errors).toHaveLength(0);
      expect(infos.join(' ')).toContain('FCM initialized');
    });
  });

  it('stays a no-op when credentials are absent, without throwing', async () => {
    await jest.isolateModulesAsync(async () => {
      process.env.FIREBASE_PROJECT_ID = '';
      process.env.FIREBASE_CLIENT_EMAIL = '';
      process.env.FIREBASE_PRIVATE_KEY = '';
      const { initFCM, sendPushNotification } = await import('../fcm.service');
      await expect(initFCM()).resolves.toBeUndefined();
      await expect(sendPushNotification('some-token', 'Title', 'Body')).resolves.not.toThrow();
    });
  });
});
