import { execSync } from 'child_process';
import path from 'path';
import { assertSharedTestDatabase, resolveTestDatabaseUrl } from '../lib/test-database';

export default async function globalSetup(): Promise<void> {
  const url = resolveTestDatabaseUrl();
  assertSharedTestDatabase(url);
  // Build the throwaway tmpfs DB from the migration ledger (never db push):
  // every integration run doubles as a regression test that a fresh database
  // can be built from migrations alone (F4a). Data cleanup stays truncateAll's job.
  execSync('npx prisma migrate deploy', {
    cwd: path.join(__dirname, '../..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
}
