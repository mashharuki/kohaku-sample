import type { TxData } from '@kohaku-eth/provider'
import { DepositStrategy } from '@kohaku-eth/tornado-cash'
import { ethAmount } from '../assets/eth.js'
import type { SendAndWait } from '../chain/wallet.js'
import { toTornadoUserError } from './errors.js'
import type { Tornado } from './plugin.js'

export function parseStrategy(s: string): DepositStrategy {
  if (s === 'minfee') return DepositStrategy.MinFee
  if (s === 'maxanon') return DepositStrategy.MaxAnonimitySet
  throw new Error(`Unknown strategy "${s}" (expected minfee or maxanon)`)
}

export type ShieldPlan = { txns: TxData[]; requested: bigint; deposited: bigint; remainder: bigint }

/** Builds the deposit txs and checks their value sum against the requested amount — a
 *  remainder that fills no pool denomination is silently dropped by prepareShield. */
export async function planTcShield(
  t: Tornado,
  amountWei: bigint,
  strategy: DepositStrategy,
): Promise<ShieldPlan> {
  try {
    const { txns } = await t.prepareShield(ethAmount(amountWei), { strategy })
    const deposited = txns.reduce((sum, tx) => sum + tx.value, 0n)
    return { txns, requested: amountWei, deposited, remainder: amountWei - deposited }
  } catch (e) {
    throw toTornadoUserError(e)
  }
}

/** Sends the shield txs in order, awaiting each receipt before sending the next. */
export async function executeTcShield(
  plan: ShieldPlan,
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
