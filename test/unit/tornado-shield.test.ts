import type { TxData } from '@kohaku-eth/provider'
import { DepositStrategy } from '@kohaku-eth/tornado-cash'
import { describe, expect, it, vi } from 'vitest'
import type { Tornado } from '../../src/tornado/plugin.js'
import { executeTcShield, parseStrategy, planTcShield } from '../../src/tornado/shield.js'

describe('parseStrategy', () => {
  it('maps "minfee" and "maxanon" to the SDK enum values', () => {
    expect(parseStrategy('minfee')).toBe(DepositStrategy.MinFee)
    expect(parseStrategy('maxanon')).toBe(DepositStrategy.MaxAnonimitySet)
  })

  it('rejects anything else', () => {
    expect(() => parseStrategy('yolo')).toThrow(/Unknown strategy/)
  })
})

function mockTornado(txns: TxData[]) {
  return { prepareShield: vi.fn(async () => ({ txns })) } as unknown as Tornado
}

describe('planTcShield', () => {
  it('reports no remainder when the deposit txs sum to the requested amount', async () => {
    const txns = [{ value: 100n }, { value: 1n }] as unknown as TxData[]
    const tornado = mockTornado(txns)
    const plan = await planTcShield(tornado, 101n, DepositStrategy.MinFee)
    expect(plan).toEqual({ txns, requested: 101n, deposited: 101n, remainder: 0n })
  })

  it('surfaces a remainder when the requested amount does not divide into available denominations', async () => {
    const txns = [{ value: 100n }] as unknown as TxData[]
    const tornado = mockTornado(txns)
    const plan = await planTcShield(tornado, 150_000_000n + 100n, DepositStrategy.MinFee)
    expect(plan.deposited).toBe(100n)
    expect(plan.remainder).toBe(150_000_000n)
  })

  it('passes the strategy through to prepareShield', async () => {
    const tornado = mockTornado([])
    await planTcShield(tornado, 1n, DepositStrategy.MaxAnonimitySet)
    expect(tornado.prepareShield).toHaveBeenCalledWith(expect.anything(), {
      strategy: DepositStrategy.MaxAnonimitySet,
    })
  })
})

describe('executeTcShield', () => {
  it('sends every tx in order and returns their receipts', async () => {
    const txns = [{ to: '0x1' }, { to: '0x2' }] as unknown as TxData[]
    const sendAndWait = vi
      .fn()
      .mockResolvedValueOnce({ hash: '0x1', status: 1n })
      .mockResolvedValueOnce({ hash: '0x2', status: 1n })
    const plan = { txns, requested: 1n, deposited: 1n, remainder: 0n }
    const receipts = await executeTcShield(plan, sendAndWait)
    expect(receipts).toEqual([
      { hash: '0x1', status: 1n },
      { hash: '0x2', status: 1n },
    ])
  })

  it('throws on the first reverted tx and does not send the rest', async () => {
    const txns = [{ to: '0x1' }, { to: '0x2' }] as unknown as TxData[]
    const sendAndWait = vi
      .fn()
      .mockResolvedValueOnce({ hash: '0x1', status: 0n })
      .mockResolvedValueOnce({ hash: '0x2', status: 1n })
    const plan = { txns, requested: 1n, deposited: 1n, remainder: 0n }
    await expect(executeTcShield(plan, sendAndWait)).rejects.toThrow(/reverted/)
    expect(sendAndWait).toHaveBeenCalledTimes(1)
  })
})
