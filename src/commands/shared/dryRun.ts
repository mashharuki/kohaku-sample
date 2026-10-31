import { createInterface } from 'node:readline/promises'

/**
 * Every write command is a dry run by default. It only sends anything when --execute is
 * passed AND the user types "yes" at an interactive confirmation prompt.
 */
export async function confirmExecute(summary: string): Promise<boolean> {
  console.log(summary)
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = await rl.question('\nType "yes" to send this to Sepolia, anything else to abort: ')
    return answer.trim().toLowerCase() === 'yes'
  } finally {
    rl.close()
  }
}

export function printDryRunNotice(): void {
  console.log('\n(dry run — nothing was sent. Re-run with --execute to send it for real.)')
}
