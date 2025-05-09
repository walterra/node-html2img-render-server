module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  collectCoverageFrom: ['src/**/*.js', '!**/node_modules/**', '!**/coverage/**'],
  verbose: true,
  testTimeout: 15000 // Increase timeout for tests that involve rendering
};
