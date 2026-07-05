process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/quran_review_test';
process.env.JWT_SECRET = 'integration-test-secret-0123456789abcdef0123456789abcdef';
