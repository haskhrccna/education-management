process.env.NODE_ENV = 'test';

// Both suites share one database. A TEST_DATABASE_URL that names anything else
// is a misconfiguration, not a fallback — refuse it before config/index.ts
// reads DATABASE_URL at import time.
const { assertSharedTestDatabase, resolveTestDatabaseUrl } = require('../lib/test-database');
const url = resolveTestDatabaseUrl();
assertSharedTestDatabase(url);
process.env.DATABASE_URL = url;

process.env.JWT_SECRET = 'integration-test-secret-0123456789abcdef0123456789abcdef';

// The dev shell may export STORAGE_ENABLED=1 for a local MinIO. Tests that
// exercise object storage set it themselves; inheriting it turns a missing
// local file into a 503 against a bucket that is not running.
delete process.env.STORAGE_ENABLED;
