// jest.config.js

module.exports = {
  displayName: 'Unit Tests',
  testEnvironment: 'node',

  // PARALLEL execution for fast feedback (unit tests are isolated)
  maxWorkers: '50%',

  // Fast timeout - unit tests should be <1s, max 5s
  testTimeout: 5000,

  // Detect issues, don't hide them
  detectOpenHandles: true,
  forceExit: false, // Fail if handles are open (indicates a problem)

  // Pattern dei file di test - SOLO unit tests (no integration/e2e)
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/src/**/*.test.ts'],

  // Escludi integration e e2e tests dagli unit tests
  testPathIgnorePatterns: [
    '/node_modules/',
    '/reference/',
    '\\.integration\\.spec\\.ts$',
    '\\.e2e\\.spec\\.ts$',
  ],

  // Moduli da trasformare con TypeScript
  preset: 'ts-jest',

  // Mapping dei moduli per import relativi (corretto nome)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@test/(.*)$': '<rootDir>/test/$1',
  },

  // Coverage configuration
  collectCoverage: false, // Disabilitato per i test per performance
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
    '!src/main.ts',
    '!src/test/**',
    '!src/**/*.interface.ts',
    '!src/**/*.enum.ts',
    '!src/**/*.dto.ts',
    '!reference/**/*',
  ],

  // Coverage thresholds - Sviluppo incrementale: soglie adattate al coverage attuale
  // TODO: Incrementare progressivamente verso target finale (80/75/80/80)
  coverageThreshold: {
    global: {
      statements: 30, // Target finale: 80% (Attuale: ~35%) - Baseline per template iniziale
      branches: 25, // Target finale: 75% (Attuale: ~29%) - Baseline per template iniziale
      functions: 35, // Target finale: 80% (Attuale: ~41%) - Baseline per template iniziale
      lines: 30, // Target finale: 80% (Attuale: ~34%) - Baseline per template iniziale
    },
    // Soglie specifiche per aree critiche - manteniamo ambiziose
    './src/common/logger/': {
      statements: 60, // Target finale: 90%
      branches: 50, // Target finale: 85%
      functions: 85, // Target finale: 90%
      lines: 60, // Target finale: 90%
    },
    './src/common/filters/': {
      statements: 95, // Già ottima
      branches: 75, // Target finale: 80%
      functions: 100, // Già perfetta
      lines: 95, // Target finale: 85%
    },
    './src/health/': {
      statements: 75, // Target finale: 95%
      branches: 100, // Già perfetta
      functions: 25, // Target finale: 95%
      lines: 70, // Target finale: 95%
    },
  },

  // Coverage reports
  coverageReporters: [
    'text', // Output in console
    'text-summary', // Summary in console
    'html', // HTML report in coverage/
    'lcov', // Per integrazioni CI/CD
    'json-summary', // Per badge e metriche
  ],

  // Directory output per coverage
  coverageDirectory: 'coverage',

  // Ignora i moduli node_modules tranne alcuni specifici se necessario
  transformIgnorePatterns: ['node_modules/(?!(testcontainers)/)'],
};
