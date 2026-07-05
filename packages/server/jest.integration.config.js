/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__integration__/**/*.itest.ts'],
  moduleNameMapper: {
    '^@edu/shared$': '<rootDir>/../shared/src/index.ts',
    '^@quran-review/shared$': '<rootDir>/../shared/src/index.ts',
  },
  setupFiles: ['<rootDir>/src/__integration__/env.ts'],
  globalSetup: '<rootDir>/src/__integration__/global-setup.ts',
  testTimeout: 30000,
  maxWorkers: 1,
  // BullMQ keeps Redis connections open when a local Redis is running, which
  // otherwise holds the process alive after all suites pass.
  forceExit: true,
};
