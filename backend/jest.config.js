/**
 * Jest Configuration
 * Configured for ES Modules (ESM) and backend testing with Supertest
 */

export default {
  // Use Node test environment with ES modules support
  testEnvironment: 'node',
  transform: {},

  // Enable coverage collection
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/config/**',
    '!src/index.js',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/tests/',
  ],
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },

  // Test match patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/?(*.)+(spec|test).js',
  ],

  // Transform files - use babel for ES modules
  transform: {
    '^.+\\.js$': ['babel-jest', { presets: [['@babel/preset-env', { targets: { node: 'current' } }]] }],
  },

  // Module name mapper for imports
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  // Verbose output
  verbose: true,

  // Timeout for tests
  testTimeout: 10000,

  // Max workers for parallel testing
  maxWorkers: '50%',
};
