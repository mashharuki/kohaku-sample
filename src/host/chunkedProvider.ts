import type { EthereumProvider } from '@kohaku-eth/provider'
import type { Filter } from 'ox/Filter'

const DEFAULT_MAX_SPAN = 499n
const DEFAULT_DELAY_MS = 0

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Wraps a provider's getLogs so a wide block range is split into chunks of at most
 * `maxSpan` blocks. Many RPC providers reject eth_getLogs ranges above a few hundred/
 * thousand blocks, which would otherwise break Kohaku's cold sync.
 *
 * A smaller `maxSpan` means more chunk requests for the same range — on a free-tier RPC
 * plan with a low compute-units-per-second budget (e.g. Alchemy), firing them back to back
 * can trip rate limiting (HTTP 429) even though each individual request succeeds. `delayMs`
 * pauses between chunks to stay under that budget.
 */
export function withChunkedGetLogs<T>(
  provider: EthereumProvider<T>,
  maxSpan: bigint = DEFAULT_MAX_SPAN,
  delayMs: number = DEFAULT_DELAY_MS,
): EthereumProvider<T> {
  return {
    ...provider,
    async getLogs(filter: Filter) {
      const head = await provider.getBlockNumber()
      const toBig = (b: Filter['fromBlock'], fallback: bigint): bigint =>
        b === undefined || b === null || b === 'latest' || b === 'pending' || b === 'earliest'
          ? fallback
          : BigInt(b as bigint)
      const from = toBig(filter.fromBlock, 0n)
      const to = toBig(filter.toBlock, head)

      const out = []
      for (let start = from; start <= to; start += maxSpan + 1n) {
        if (delayMs > 0 && start > from) await sleep(delayMs)
        // biome-ignore lint/complexity/useMathMinMax: Math.min() doesn't support BigInt operands
        const end = start + maxSpan > to ? to : start + maxSpan
        out.push(...(await provider.getLogs({ ...filter, fromBlock: start, toBlock: end })))
      }
      return out
    },
  }
}
