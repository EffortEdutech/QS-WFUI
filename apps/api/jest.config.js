/** PD-2 — Jest configuration for the Lados API + platform test baseline.
 *
 * Tests live in:
 *   src/**\/*.spec.ts   — unit tests colocated with modules
 *   test/**\/*.spec.ts  — cross-package platform tests (engine, packs)
 *
 * Workspace packages (@lados/*) resolve through pnpm symlinks to their
 * built dist/ output — run `pnpm build` before `pnpm test`.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', diagnostics: false }],
  },
  clearMocks: true,
};
