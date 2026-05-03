// Jest configuration for the A'lochi API.
//
// Coverage threshold strategy:
//   - Aspirational target: 80% lines (industry standard for production services).
//   - Current actual floor (Phase 22, 2026-04-30): ~33% lines / ~32% branches.
//   - Threshold below is set at the floor minus a small buffer so the build
//     stays green today, but regressions below the floor will fail CI.
//   - Ratchet UP over time as new tests are added — never relax the threshold.
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  // isomorphic-dompurify → jsdom → html-encoding-sniffer → @exodus/bytes
  // ships as ESM which ts-jest cannot transform. Stub it out in tests:
  // chat.service sanitises user input at runtime; unit tests only need the
  // mock to exist so the module graph resolves.
  moduleNameMapper: {
    '^isomorphic-dompurify$': '<rootDir>/__mocks__/isomorphic-dompurify.js',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.module.ts',
    '!src/main.ts',
    '!src/**/*.dto.ts',
    '!src/**/*.entity.ts',
  ],
  coverageDirectory: '../coverage',
  coverageReporters: ['text', 'text-summary', 'html', 'lcov'],
  coverageThreshold: {
    global: {
      lines: 30,
      branches: 25,
      functions: 25,
      statements: 30,
    },
  },
  testEnvironment: 'node',
};
