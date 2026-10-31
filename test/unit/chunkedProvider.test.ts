import type { EthereumProvider } from '@kohaku-eth/provider'
import type { Filter } from 'ox/Filter'
import { describe, expect, it } from 'vitest'
import { withChunkedGetLogs } from '../../src/host/chunkedProvider.js'

function fakeProvider(headBlock: bigint) {
  const calls: Filter[] = []
  const provider = {
    getBlockNumber: async () => headBlock,
    getLogs: async (filter: Filter) => {
      calls.push(filter)
      return [{ fromBlock: filter.fromBlock, toBlock: filter.toBlock }]
    },
  } as unknown as EthereumProvider
  return { provider, calls }
}

describe('withChunkedGetLogs', () => {
  it('passes a range within maxSpan through as a single call', async () => {
    const { provider, calls } = fakeProvider(1000n)
    const chunked = withChunkedGetLogs(provider, 499n)
    await chunked.getLogs({ fromBlock: 0n, toBlock: 100n })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ fromBlock: 0n, toBlock: 100n })
  })

  it('splits a wide range into chunks of at most maxSpan blocks, covering it exactly once', async () => {
    const { provider, calls } = fakeProvider(2000n)
    const chunked = withChunkedGetLogs(provider, 499n)
    await chunked.getLogs({ fromBlock: 0n, toBlock: 1200n })

    expect(calls).toEqual([
      { fromBlock: 0n, toBlock: 499n },
      { fromBlock: 500n, toBlock: 999n },
      { fromBlock: 1000n, toBlock: 1200n },
    ])
  })

  it('resolves "latest"/undefined toBlock against the current head block', async () => {
    const { provider, calls } = fakeProvider(600n)
    const chunked = withChunkedGetLogs(provider, 499n)
    await chunked.getLogs({ fromBlock: 0n, toBlock: 'latest' })

    expect(calls).toEqual([
      { fromBlock: 0n, toBlock: 499n },
      { fromBlock: 500n, toBlock: 600n },
    ])
  })

  it('aggregates results from every chunk', async () => {
    const { provider } = fakeProvider(1000n)
    const chunked = withChunkedGetLogs(provider, 499n)
    const logs = await chunked.getLogs({ fromBlock: 0n, toBlock: 1000n })
    expect(logs).toHaveLength(3)
  })
})
