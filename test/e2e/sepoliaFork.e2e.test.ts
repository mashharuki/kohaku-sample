// Fork e2e: boots a real anvil instance (via prool) forking Sepolia, and exercises the actual
// Node provider stack (chunked getLogs + the Sepolia chain-id guard) against it. Skipped
// entirely when ANVIL_FORK_RPC_URL is unset, per .env.example's documented contract — these
// tests need an archive RPC to fork from and are not expected to run in CI by default.
import { sepolia } from 'viem/chains'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { makeNodeProvider } from '../../src/host/createHost.js'
import { startAnvilFork, type AnvilFork } from './utils/anvil.js'

const FORK_RPC_URL = process.env.ANVIL_FORK_RPC_URL
const FORK_BLOCK = process.env.ANVIL_FORK_BLOCK ? BigInt(process.env.ANVIL_FORK_BLOCK) : undefined

describe.skipIf(!FORK_RPC_URL)('Sepolia fork (anvil)', () => {
  let fork: AnvilFork

  beforeAll(async () => {
    fork = await startAnvilFork({ forkUrl: FORK_RPC_URL as string, forkBlockNumber: FORK_BLOCK })
  })

  afterAll(async () => {
    await fork?.stop()
  })

  it('the forked chain reports Sepolia\'s chain id, and makeNodeProvider accepts it', async () => {
    const provider = await makeNodeProvider({ rpcUrl: fork.rpcUrl, chain: sepolia })
    expect(await provider.getChainId()).toBe(11155111n)
  })

  it('chunked getLogs covers a wide range by stitching several small requests', async () => {
    const provider = await makeNodeProvider({ rpcUrl: fork.rpcUrl, chain: sepolia })
    const forkHead = await provider.getBlockNumber()

    // Mine comfortably past withChunkedGetLogs' default 499-block span so this actually
    // exercises the chunking, not just a single pass-through call. Mined locally (rather than
    // querying pre-fork history) so the range never needs anvil to proxy eth_getLogs upstream —
    // the public RPC this forks from rejects unfiltered (no `address`) historical queries.
    const blocksToMine = 1500
    await provider.request({ method: 'anvil_mine', params: [blocksToMine] })

    // forkHead itself is a real, already-mined Sepolia block (may have real logs); only the
    // blocks mined just above it are guaranteed empty.
    const logs = await provider.getLogs({ fromBlock: forkHead + 1n, toBlock: forkHead + BigInt(blocksToMine) })
    expect(logs).toEqual([])
  })
})
