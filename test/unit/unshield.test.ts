import { beforeEach, describe, expect, it, vi } from 'vitest'
import { previewTcUnshield } from '../../src/tornado/unshield.js'

describe('previewTcUnshield', () => {
  it('is purely informational: no fee preview exists for Tornado Cash', () => {
    const preview = previewTcUnshield('0xabc', 100n)
    expect(preview).toEqual({
      recipient: '0xabc',
      amountWei: 100n,
      note: expect.stringContaining('no fee-preview call'),
    })
  })
})

const broadcastMock = vi.fn()
vi.mock('@kohaku-eth/tornado-cash', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@kohaku-eth/tornado-cash')>()
  return { ...actual, createTCBroadcaster: () => ({ broadcast: broadcastMock }) }
})

describe('executeTcUnshield', () => {
  beforeEach(() => {
    broadcastMock.mockReset()
  })

  it('requests paymaster mode with deterministic delegation, and returns fees/fallback/receipts', async () => {
    const { executeTcUnshield } = await import('../../src/tornado/unshield.js')
    const prepareUnshield = vi.fn(async () => ({
      withdrawals: [{ fee: 5n, gasEstimation: { status: 'ok' } }, { fee: 3n, gasEstimation: { status: 'fallback' } }],
    }))
    broadcastMock.mockResolvedValue(['receipt-1'])
    const tornado = { prepareUnshield } as unknown as Parameters<typeof executeTcUnshield>[1]
    const host = {} as unknown as Parameters<typeof executeTcUnshield>[0]

    const result = await executeTcUnshield(host, tornado, '0xabc', 100n, {})

    expect(prepareUnshield).toHaveBeenCalledWith(
      expect.anything(),
      '0xabc',
      expect.objectContaining({ mode: 'paymaster', delegation: { mode: 'deterministic' }, gasEstimationPolicy: 'best-effort' }),
    )
    expect(result).toEqual({ fees: [5n, 3n], fallback: true, receipts: ['receipt-1'] })
  })

  it('uses gasEstimationPolicy "required" when --strict is set', async () => {
    const { executeTcUnshield } = await import('../../src/tornado/unshield.js')
    const prepareUnshield = vi.fn(async () => ({ withdrawals: [] }))
    broadcastMock.mockResolvedValue([])
    const tornado = { prepareUnshield } as unknown as Parameters<typeof executeTcUnshield>[1]
    const host = {} as unknown as Parameters<typeof executeTcUnshield>[0]

    await executeTcUnshield(host, tornado, '0xabc', 100n, { strict: true })

    expect(prepareUnshield).toHaveBeenCalledWith(expect.anything(), '0xabc', expect.objectContaining({ gasEstimationPolicy: 'required' }))
  })

  it('maps SDK errors through toTornadoUserError', async () => {
    const { executeTcUnshield } = await import('../../src/tornado/unshield.js')
    const prepareUnshield = vi.fn(async () => {
      throw new Error('Insufficient balance for withdrawal')
    })
    const tornado = { prepareUnshield } as unknown as Parameters<typeof executeTcUnshield>[1]
    const host = {} as unknown as Parameters<typeof executeTcUnshield>[0]

    await expect(executeTcUnshield(host, tornado, '0xabc', 100n, {})).rejects.toThrow(/tc:notes/)
  })
})
