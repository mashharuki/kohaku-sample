import { defineWorkspace } from 'vitest/config'

// `pnpm test` / `pnpm test:e2e` select a project by name via `vitest run --project <name>`.
export default defineWorkspace([
  {
    extends: './vitest.config.ts',
    test: {
      name: 'unit',
      include: ['test/unit/**/*.test.ts'],
    },
  },
  {
    extends: './vitest.config.ts',
    test: {
      name: 'e2e',
      include: ['test/e2e/**/*.test.ts'],
      // Proofs and anvil fork boot are real and slow (seconds to a minute each).
      testTimeout: 5 * 60 * 1000,
      hookTimeout: 2 * 60 * 1000,
    },
  },
])
