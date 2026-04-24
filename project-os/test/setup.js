import 'dotenv/config';

// Redirect DATABASE_URL to the test DB for all files that import the pool.
// If TEST_DATABASE_URL is not set, DB-dependent tests will fail at connection time
// with a clear error. Unit tests (no DB pool import) are unaffected.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

process.env.JWT_SECRET ??= 'test-secret-not-for-production';
process.env.ANTHROPIC_API_KEY ??= 'test-api-key-not-real';
process.env.JUDGE_SAMPLE_RATE = '0';
process.env.NODE_ENV = 'test';
