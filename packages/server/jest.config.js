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
  collectCoverageFrom: [
    'src/services/**/*.ts',
    'src/controllers/**/*.ts',
    'src/middleware/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
};
