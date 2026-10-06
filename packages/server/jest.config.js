/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@edu/shared$': '<rootDir>/../shared/src/index.ts',
    '^@quran-review/shared$': '<rootDir>/../shared/src/index.ts',
  },
  // Same database guard as the integration suite: config/index.ts reads
  // DATABASE_URL at import time, and a suite pointed anywhere but the shared
  // test database is refused before it can run.
  setupFiles: ['<rootDir>/src/__integration__/env.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  // src/controllers/ has not existed since the module refactor, and the two
  // layers that were missing — lib/ (contract router, storage, queue, health)
  // and modules/ (every route handler) — were never measured, so the reported
  // number described a shrinking slice of the server.
  collectCoverageFrom: [
    'src/services/**/*.ts',
    'src/modules/**/*.ts',
    'src/middleware/**/*.ts',
    'src/lib/**/*.ts',
    'src/routes/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  // Floor, not a target: set just under what the unit suite covers today
  // (2026-10-07: 56% statements, 42% branches, 37% functions over src/**), so
  // coverage can only go up from here. The integration suite covers more and
  // is not counted in this number. Raise these as the gap closes.
  coverageThreshold: {
    global: { statements: 55, branches: 40, functions: 35, lines: 55 },
  },
};
