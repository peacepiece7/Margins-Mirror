module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  setupFilesAfterEnv: ['<rootDir>/src/testing/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/app/**',
    '!src/**/*.d.ts',
    '!src/testing/**',
  ],
};
