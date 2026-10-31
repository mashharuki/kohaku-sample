import { defineConfig } from 'vitest/config'

// Published @kohaku-eth/* dist uses extensionless ESM imports (and privacy-pools deep-imports
// maci-crypto), which plain Node ESM / Vitest's default externalization can't resolve. Inlining
// lets Vite transform them instead. Shared by both the unit and e2e projects.
export default defineConfig({
  test: {
    server: { deps: { inline: [/@kohaku-eth\//, /maci-crypto/] } },
  },
})
