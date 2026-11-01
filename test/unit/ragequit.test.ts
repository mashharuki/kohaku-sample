import type { TxData } from '@kohaku-eth/provider'
import { describe, expect, it, vi } from 'vitest'
import type { Pools } from '../../src/privacy-pools/plugin.js'
import { executeRagequit, planRagequit } from '../../src/privacy-pools/ragequit.js'

function mockPools(notes: { label: bigint; approved: boolean }[], ragequitTxns: TxData[] = []) {
  return {
    sync: vi.fn(async () => undefined),
    notes: vi.fn(async () => notes),
    ragequit: vi.fn(async () => ({ txns: ragequitTxns })),
  } as unknown as Pools
}

describe('planRagequit', () => {
  it('only includes unapproved (pending) notes', async () => {
    const txns = [{ to: '0x1' }] as unknown as TxData[]
    const pools = mockPools(
      [
        { label: 1n, approved: true },
        { label: 2n, approved: false },
        { label: 3n, approved: false },
      ],
      txns,
    )
    const plan = await planRagequit(pools)
    expect(plan.pendingNotes.map((n) => n.label)).toEqual([2n, 3n])
    expect(pools.ragequit).toHaveBeenCalledWith([2n, 3n])
    expect(plan.txns).toEqual(txns)
  })

  it('skips calling ragequit entirely when there are no pending notes', async () => {
    const pools = mockPools([{ label: 1n, approved: true }])
    const plan = await planRagequit(pools)
    expect(plan).toEqual({ pendingNotes: [], txns: [] })
    expect(pools.ragequit).not.toHaveBeenCalled()
  })

  it('maps SDK errors through toPpUserError', async () => {
    const pools = {
      sync: vi.fn(async () => undefined),
      notes: vi.fn(async () => [{ label: 1n, approved: false }]),
      ragequit: vi.fn(async () => {
        throw new Error('No paymaster adapter configured for pool')
      }),
    } as unknown as Pools
    await expect(planRagequit(pools)).rejects.toThrow(/ragequit instead/)
  })
})

describe('executeRagequit', () => {
  it('sends every tx in order and returns their receipts', async () => {
    const txns = [{ to: '0x1' }, { to: '0x2' }] as unknown as TxData[]
    const sendAndWait = vi
      .fn()
      .mockResolvedValueOnce({ hash: '0x1', status: 1n })
      .mockResolvedValueOnce({ hash: '0x2', status: 1n })
    const receipts = await executeRagequit({ pendingNotes: [], txns }, sendAndWait)
    expect(receipts).toEqual([
      { hash: '0x1', status: 1n },
      { hash: '0x2', status: 1n },
    ])
  })

  it('throws on a reverted tx', async () => {
    const txns = [{ to: '0x1' }] as unknown as TxData[]
    const sendAndWait = vi.fn().mockResolvedValueOnce({ hash: '0x1', status: 0n })
    await expect(executeRagequit({ pendingNotes: [], txns }, sendAndWait)).rejects.toThrow(
      /reverted/,
    )
  })
})
