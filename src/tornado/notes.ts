import { ETH_ASSET, isEthAssetAddress } from '../assets/eth.js'
import type { Tornado } from './plugin.js'

export async function getTcBalanceAndNotes(t: Tornado, includeSpent = false) {
  await t.sync()
  const balanceRows = await t.balance([ETH_ASSET])
  if (!t.notes) throw new Error('notes() unavailable on this plugin instance')
  const notes = await t.notes([ETH_ASSET], includeSpent)
  return {
    balance: balanceRows,
    notes: notes.map((n) => ({ ...n, isEth: isEthAssetAddress(n.assetAddress) })),
  }
}
