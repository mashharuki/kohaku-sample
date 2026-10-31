import type { PPv1ShieldEstimate } from '@kohaku-eth/privacy-pools'
import type { TxData } from '@kohaku-eth/provider'
import { describe, expect, it, vi } from 'vitest'
import type { SendAndWait } from '../../src/chain/wallet.js'
import { executePpShield, planPpShield } from '../../src/privacy-pools/shield.js'
import type { Pools } from '../../src/privacy-pools/plugin.js'

function mockPools(opts: { minimumDeposit: bigint; txns: TxData[] }) {
  return {
    estimateShield: vi.fn(async () => ({ minimumDeposit: opts.minimumDeposit }) as unknown as PPv1ShieldEstimate),
    prepareShield: vi.fn(async () => ({ txns: opts.txns })),
  } as unknown as Pools
}

describe('planPpShield', () => {
  it('estimates first and plans the shield when the amount is at or above the minimum deposit', async () => {
    const txns = [{ to: '0x1', value: 10n }] as unknown as TxData[]
    const pools = mockPools({ minimumDeposit: 5n, txns })
    const plan = await planPpShield(pools, 10n)
    expect(plan).toEqual({ txns, quote: { minimumDeposit: 5n }, amountWei: 10n })
    const estimateOrder = (pools.estimateShield as unknown as ReturnType<typeof vi.fn>).mock.invocationCallOrder.at(0) ?? -1
    const prepareOrder = (pools.prepareShield as unknown as ReturnType<typeof vi.fn>).mock.invocationCallOrder.at(0) ?? -1
    expect(estimateOrder).toBeLessThan(prepareOrder)
  })

  it('rejects an amount below the minimum deposit before calling prepareShield', async () => {
    const pools = mockPools({ minimumDeposit: 100n, txns: [] })
    await expect(planPpShield(pools, 10n)).rejects.toThrow(/below the minimum deposit/)
    expect(pools.prepareShield).not.toHaveBeenCalled()
  })

  it('maps SDK errors through toPpUserError', async () => {
    const pools = {
      estimateShield: vi.fn(async () => {
        throw new Error('No paymaster adapter configured for pool')
      }),
      prepareShield: vi.fn(),
    } as unknown as Pools
    await expect(planPpShield(pools, 10n)).rejects.toThrow(/ragequit/)
  })
})

describe('executePpShield', () => {
  it('sends every tx in order and returns their receipts', async () => {
    const txns = [{ to: '0x1' }, { to: '0x2' }] as unknown as TxData[]
    const sent: TxData[] = []
    const sendAndWait: SendAndWait = vi.fn(async (tx: TxData) => {
      sent.push(tx)
      return { hash: `0x${sent.length}` as const, status: 1n }
    })
    const receipts = await executePpShield({ txns, quote: {} as PPv1ShieldEstimate, amountWei: 1n }, sendAndWait)
    expect(sent).toEqual(txns)
    expect(receipts).toEqual([
      { hash: '0x1', status: 1n },
      { hash: '0x2', status: 1n },
    ])
  })

  it('throws and stops on the first reverted tx', async () => {
    const txns = [{ to: '0x1' }, { to: '0x2' }] as unknown as TxData[]
    const sendAndWait = vi
      .fn()
      .mockResolvedValueOnce({ hash: '0x1', status: 1n })
      .mockResolvedValueOnce({ hash: '0x2', status: 0n })
    await expect(executePpShield({ txns, quote: {} as PPv1ShieldEstimate, amountWei: 1n }, sendAndWait)).rejects.toThrow(/reverted/)
    expect(sendAndWait).toHaveBeenCalledTimes(2)
  })
})
