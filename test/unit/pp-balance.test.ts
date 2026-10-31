import { describe, expect, it, vi } from 'vitest'
import { getPpBalanceAndNotes } from '../../src/privacy-pools/balance.js'
import type { Pools } from '../../src/privacy-pools/plugin.js'

function mockPools(rows: { tag?: string; amount: bigint }[]) {
  return {
    sync: vi.fn(async () => undefined),
    balance: vi.fn(async () => rows),
    notes: vi.fn(async () => ['note-1']),
    history: vi.fn(async () => ['event-1']),
  } as unknown as Pools
}

describe('getPpBalanceAndNotes', () => {
  it('syncs before reading, and separates approved from pending by tag', async () => {
    const pools = mockPools([
      { amount: 7n },
      { tag: 'pending', amount: 3n },
    ])
    const result = await getPpBalanceAndNotes(pools)
    expect(pools.sync).toHaveBeenCalledTimes(1)
    expect(result.approved).toBe(7n)
    expect(result.pending).toBe(3n)
    expect(result.total).toBe(10n)
    expect(result.notes).toEqual(['note-1'])
    expect(result.history).toEqual(['event-1'])
  })

  it('defaults approved and pending to 0n when a row is missing', async () => {
    const pools = mockPools([])
    const result = await getPpBalanceAndNotes(pools)
    expect(result).toMatchObject({ approved: 0n, pending: 0n, total: 0n })
  })

  it('passes { sync: false } to balance/notes/history since it already synced once itself', async () => {
    const pools = mockPools([])
    await getPpBalanceAndNotes(pools)
    expect(pools.balance).toHaveBeenCalledWith(expect.anything(), { sync: false })
    expect(pools.notes).toHaveBeenCalledWith(expect.anything(), false, { sync: false })
    expect(pools.history).toHaveBeenCalledWith(expect.anything(), { sync: false })
  })
})
