import { execSync } from 'child_process';
import path from 'path';

export default async function globalSetup(): Promise<void> {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/quran_review_test';
  // No --force-reset: the target is a throwaway tmpfs container DB, schema-sync is
  // sufficient (data cleanup is truncateAll's job), and Prisma gates the flag for AI agents.
  execSync('npx prisma db push --accept-data-loss --skip-generate', {
    cwd: path.join(__dirname, '../..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
}
