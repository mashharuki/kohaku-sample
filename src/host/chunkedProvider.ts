import type { EthereumProvider } from '@kohaku-eth/provider'
import type { Filter } from 'ox/Filter'

const DEFAULT_MAX_SPAN = 499n

/**
 * Wraps a provider's getLogs so a wide block range is split into chunks of at most
 * `maxSpan` blocks. Many RPC providers reject eth_getLogs ranges above a few hundred/
 * thousand blocks, which would otherwise break Kohaku's cold sync.
 */
export function withChunkedGetLogs<T>(provider: EthereumProvider<T>, maxSpan: bigint = DEFAULT_MAX_SPAN): EthereumProvider<T> {
  return {
    ...provider,
    async getLogs(filter: Filter) {
      const head = await provider.getBlockNumber()
      const toBig = (b: Filter['fromBlock'], fallback: bigint): bigint =>
        b === undefined || b === null || b === 'latest' || b === 'pending' || b === 'earliest' ? fallback : BigInt(b as bigint)
      const from = toBig(filter.fromBlock, 0n)
      const to = toBig(filter.toBlock, head)

      const out = []
      for (let start = from; start <= to; start += maxSpan + 1n) {
        const end = start + maxSpan > to ? to : start + maxSpan
        out.push(...(await provider.getLogs({ ...filter, fromBlock: start, toBlock: end })))
      }
      return out
    },
  }
}
