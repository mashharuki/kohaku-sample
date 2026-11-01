import type { TxData } from '@kohaku-eth/provider'
import type { SendAndWait } from '../chain/wallet.js'
import { toPpUserError } from './errors.js'
import type { Pools } from './plugin.js'

// @kohaku-eth/privacy-pools declares INote but does not export it from the package root.
type PpNote = Awaited<ReturnType<Pools['notes']>>[number]

export type RagequitPlan = { pendingNotes: PpNote[]; txns: TxData[] }

/** Only unapproved (pending) notes can be ragequit; the plugin ignores approved labels. */
export async function planRagequit(pools: Pools): Promise<RagequitPlan> {
  await pools.sync()
  const notes = await pools.notes(undefined, false, { sync: false })
  const pendingNotes = notes.filter((n) => !n.approved)
  if (pendingNotes.length === 0) return { pendingNotes, txns: [] }
  try {
    const { txns } = await pools.ragequit(pendingNotes.map((n) => n.label))
    return { pendingNotes, txns }
  } catch (e) {
    throw toPpUserError(e)
  }
}

export async function executeRagequit(
  plan: RagequitPlan,
  sendAndWait: SendAndWait,
): Promise<{ hash: string; status: bigint }[]> {
  const receipts = []
  for (const tx of plan.txns) {
    const r = await sendAndWait(tx)
    if (r.status !== 1n) throw new Error(`Ragequit tx reverted: ${r.hash}`)
    receipts.push(r)
  }
  return receipts
}
