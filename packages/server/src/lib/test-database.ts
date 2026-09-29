/**
 * The one database every automated test is allowed to touch.
 *
 * The mobile app and the web export are the same client: they share data only
 * by talking to one API, and that API has exactly one DATABASE_URL. Tests must
 * follow the same rule. Two URLs used to exist (education_test on 5432 for the
 * unit job, quran_review_test on 5433 for integration) and a mis-set
 * DATABASE_URL could point a suite at the dev database. Both suites now resolve
 * through this module, and anything that is not the shared test database is
 * refused before a single query runs.
 */

export const SHARED_TEST_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/quran_review_test';

const SHARED_TEST_DATABASE_NAME = 'quran_review_test';

export function resolveTestDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env.TEST_DATABASE_URL ?? SHARED_TEST_DATABASE_URL;
}

/** Throw unless `url` names the shared test database. Never the dev one. */
export function assertSharedTestDatabase(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Test DATABASE_URL is not a URL: ${url}`);
  }
  const name = parsed.pathname.replace(/^\//, '').split('/')[0];
  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new Error(`Tests only run against PostgreSQL (got ${parsed.protocol}).`);
  }
  if (name !== SHARED_TEST_DATABASE_NAME) {
    throw new Error(
      `Tests must use the shared test database "${SHARED_TEST_DATABASE_NAME}" so the ` +
        `mobile app and the web export are proven against the same data. Got "${name || '(none)'}". ` +
        `Set TEST_DATABASE_URL, do not point DATABASE_URL at a different database.`
    );
  }
}
