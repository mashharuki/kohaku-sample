import type { Host } from '@kohaku-eth/plugins'
import { createTCBroadcaster, type GasEstimationPolicy } from '@kohaku-eth/tornado-cash'
import { ethAmount, type Hex } from '../assets/eth.js'
import { toTornadoUserError } from './errors.js'
import type { Tornado } from './plugin.js'

export type TcUnshieldPreview = { recipient: Hex; amountWei: bigint; note: string }

/**
 * Tornado Cash has no estimateUnshield (unlike Privacy Pools) — there is no way to see the
 * real fee without calling prepareUnshield, which is itself not a dry run (it sends a signed
 * op to the bundler for estimation). So the dry-run preview here is informational only.
 */
export function previewTcUnshield(recipient: Hex, amountWei: bigint): TcUnshieldPreview {
  return {
    recipient,
    amountWei,
    note: 'Tornado Cash has no fee-preview call. The real fee is only known after --execute (prepareUnshield is not a dry run).',
  }
}

export async function executeTcUnshield(host: Host, t: Tornado, recipient: Hex, amountWei: bigint, opts: { strict?: boolean; callGasCeiling?: bigint }) {
  try {
    const gasEstimationPolicy: GasEstimationPolicy = opts.strict ? 'required' : 'best-effort'
    const op = await t.prepareUnshield(ethAmount(amountWei), recipient, {
      mode: 'paymaster',
      delegation: { mode: 'deterministic' },
      gasEstimationPolicy,
      ...(opts.callGasCeiling ? { maxGasLimits: { callGasLimit: opts.callGasCeiling } } : {}),
    })
    const fees = op.withdrawals.map((w) => w.fee ?? 0n)
    const fallback = op.withdrawals.some((w) => w.gasEstimation?.status === 'fallback')
    const receipts = await createTCBroadcaster(host).broadcast(op)
    return { fees, fallback, receipts }
  } catch (e) {
    throw toTornadoUserError(e)
  }
}
