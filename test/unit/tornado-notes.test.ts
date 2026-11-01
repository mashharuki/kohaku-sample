import { describe, expect, it, vi } from 'vitest'
import { getTcBalanceAndNotes } from '../../src/tornado/notes.js'
import type { Tornado } from '../../src/tornado/plugin.js'

describe('getTcBalanceAndNotes', () => {
  it('syncs, then tags each note with isEth based on the 0n sentinel', async () => {
    const tornado = {
      sync: vi.fn(async () => undefined),
      balance: vi.fn(async () => [{ amount: 1n }]),
      notes: vi.fn(async () => [
        { assetAddress: 0n, nullifier: 'a' },
        { assetAddress: 123n, nullifier: 'b' },
      ]),
    } as unknown as Tornado

    const result = await getTcBalanceAndNotes(tornado)
    expect(tornado.sync).toHaveBeenCalledTimes(1)
    expect(result.balance).toEqual([{ amount: 1n }])
    expect(result.notes).toEqual([
      { assetAddress: 0n, nullifier: 'a', isEth: true },
      { assetAddress: 123n, nullifier: 'b', isEth: false },
    ])
  })

  it('passes includeSpent through to notes()', async () => {
    const tornado = {
      sync: vi.fn(async () => undefined),
      balance: vi.fn(async () => []),
      notes: vi.fn(async () => []),
    } as unknown as Tornado

    await getTcBalanceAndNotes(tornado, true)
    expect(tornado.notes).toHaveBeenCalledWith(expect.anything(), true)
  })

  it('throws if notes() is unavailable on this plugin instance', async () => {
    const tornado = {
      sync: vi.fn(async () => undefined),
      balance: vi.fn(async () => []),
      notes: undefined,
    } as unknown as Tornado

    await expect(getTcBalanceAndNotes(tornado)).rejects.toThrow(/notes\(\) unavailable/)
  })
})
