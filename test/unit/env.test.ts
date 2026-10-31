import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ENV_KEYS = ['SEPOLIA_RPC_URL', 'MNEMONIC', 'STORAGE_PASSWORD'] as const
const originalEnv: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const k of ENV_KEYS) originalEnv[k] = process.env[k]
})

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (originalEnv[k] === undefined) delete process.env[k]
    else process.env[k] = originalEnv[k]
  }
  vi.restoreAllMocks()
})

// loadEnv() memoizes in a module-level `cached` variable, so each test needs a fresh module
// instance (vi.resetModules) to observe env changes and the memoization behavior itself.
describe('loadEnv', () => {
  it('parses a valid environment', async () => {
    vi.resetModules()
    process.env.SEPOLIA_RPC_URL = 'https://sepolia.example.com/key'
    process.env.MNEMONIC = 'test test test test test test test test test test test junk'
    process.env.STORAGE_PASSWORD = 'secret'
    const { loadEnv } = await import('../../src/config/env.js')
    const env = loadEnv()
    expect(env).toEqual({
      SEPOLIA_RPC_URL: 'https://sepolia.example.com/key',
      MNEMONIC: 'test test test test test test test test test test test junk',
      STORAGE_PASSWORD: 'secret',
    })
  })

  it('memoizes across calls within the same module instance', async () => {
    vi.resetModules()
    process.env.SEPOLIA_RPC_URL = 'https://sepolia.example.com/key'
    process.env.MNEMONIC = 'm'
    process.env.STORAGE_PASSWORD = 'p'
    const { loadEnv } = await import('../../src/config/env.js')
    const first = loadEnv()
    process.env.STORAGE_PASSWORD = 'changed-after-first-call'
    expect(loadEnv()).toBe(first)
  })

  it('exits the process and reports each invalid field when the env is incomplete', async () => {
    vi.resetModules()
    // dotenv only fills in variables that are unset, so an *invalid* value (rather than a
    // deleted one) is what actually survives loadEnv()'s internal `loadDotenv()` call even
    // when a real .env file with valid values is present on disk.
    process.env.SEPOLIA_RPC_URL = 'not-a-url'
    process.env.MNEMONIC = 'm'
    process.env.STORAGE_PASSWORD = 'p'
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((() => undefined) as unknown) as typeof process.exit)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { loadEnv } = await import('../../src/config/env.js')
    loadEnv()
    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('SEPOLIA_RPC_URL'))
  })
})
