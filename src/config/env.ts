import { config as loadDotenv } from 'dotenv'
import { z } from 'zod'

loadDotenv()

const EnvSchema = z.object({
  SEPOLIA_RPC_URL: z.string().url('SEPOLIA_RPC_URL must be a valid URL'),
  MNEMONIC: z.string().min(1, 'MNEMONIC is required'),
  STORAGE_PASSWORD: z.string().min(1, 'STORAGE_PASSWORD is required'),
})

export type Env = z.infer<typeof EnvSchema>

let cached: Env | undefined

export function loadEnv(): Env {
  if (cached) return cached
  const result = EnvSchema.safeParse(process.env)
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
    console.error(`Invalid environment configuration (see .env.example):\n${issues}`)
    process.exit(1)
  }
  cached = result.data
  return cached
}
