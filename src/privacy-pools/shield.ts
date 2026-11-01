import type { PPv1ShieldEstimate } from '@kohaku-eth/privacy-pools'
import type { TxData } from '@kohaku-eth/provider'
import { ethAmount } from '../assets/eth.js'
import type { SendAndWait } from '../chain/wallet.js'
import { toPpUserError } from './errors.js'
import type { Pools } from './plugin.js'

export type PpShieldPlan = { txns: TxData[]; quote: PPv1ShieldEstimate; amountWei: bigint }

/** estimateShield first, so a below-minimum deposit is rejected before anything is signed. */
export async function planPpShield(pools: Pools, amountWei: bigint): Promise<PpShieldPlan> {
  const asset = ethAmount(amountWei)
  try {
    const quote = await pools.estimateShield(asset)
    if (amountWei < quote.minimumDeposit) {
      throw new Error(
        `Amount ${amountWei} is below the minimum deposit ${quote.minimumDeposit} and would revert on-chain.`,
      )
    }
    const { txns } = await pools.prepareShield(asset)
    return { txns, quote, amountWei }
  } catch (e) {
    throw toPpUserError(e)
  }
}

export async function executePpShield(
  plan: PpShieldPlan,
  sendAndWait: SendAndWait,
): Promise<{ hash: string; status: bigint }[]> {
  const receipts = []
  for (const tx of plan.txns) {
    const r = await sendAndWait(tx)
    if (r.status !== 1n) throw new Error(`Shield tx reverted: ${r.hash}`)
    receipts.push(r)
  }
  return receipts
}
