import { config as loadDotenv } from 'dotenv'
import { z } from 'zod'

loadDotenv()

const EnvSchema = z.object({
  SEPOLIA_RPC_URL: z.string().url('SEPOLIA_RPC_URL must be a valid URL'),
  MNEMONIC: z.string().min(1, 'MNEMONIC is required'),
  STORAGE_PASSWORD: z.string().min(1, 'STORAGE_PASSWORD is required'),
  // Max block span per eth_getLogs call. Some free-tier RPC providers (e.g. Alchemy's free
  // plan) reject ranges above 10 blocks; lower this if you see an "Invalid params" /
  // "block range" error from eth_getLogs.
  GETLOGS_MAX_SPAN: z.coerce
    .number({ message: 'GETLOGS_MAX_SPAN must be a number' })
    .int('GETLOGS_MAX_SPAN must be an integer')
    .positive('GETLOGS_MAX_SPAN must be positive')
    .optional(),
  // Pause (ms) between eth_getLogs chunk requests. A small GETLOGS_MAX_SPAN means many more
  // chunk requests for the same range, which can trip a free-tier RPC's requests/compute-units
  // per second limit (HTTP 429) even though each individual request is valid.
  GETLOGS_DELAY_MS: z.coerce
    .number({ message: 'GETLOGS_DELAY_MS must be a number' })
    .int('GETLOGS_DELAY_MS must be an integer')
    .nonnegative('GETLOGS_DELAY_MS must not be negative')
    .optional(),
})

export type Env = z.infer<typeof EnvSchema>

let cached: Env | undefined

export function loadEnv(): Env {
  if (cached) return cached
  const result = EnvSchema.safeParse(process.env)
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    console.error(`Invalid environment configuration (see .env.example):\n${issues}`)
    process.exit(1)
  }
  cached = result.data
  return cached
}
