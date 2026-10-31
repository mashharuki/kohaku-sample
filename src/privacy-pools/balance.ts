import { ETH_ASSET } from '../assets/eth.js'
import type { Pools } from './plugin.js'

export async function getPpBalanceAndNotes(pools: Pools) {
  await pools.sync()
  const rows = await pools.balance([ETH_ASSET], { sync: false })
  const approved = rows.find((r) => r.tag === undefined)?.amount ?? 0n
  const pending = rows.find((r) => r.tag === 'pending')?.amount ?? 0n
  const notes = await pools.notes([ETH_ASSET], false, { sync: false })
  const history = await pools.history([ETH_ASSET], { sync: false })
  return { approved, pending, total: approved + pending, notes, history }
}
