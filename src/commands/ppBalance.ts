import { sepolia } from 'viem/chains'
import { loadEnv } from '../config/env.js'
import { PP_STORAGE_PATH } from '../config/paths.js'
import { makeHost, makeNodeProvider } from '../host/createHost.js'
import { createPools } from '../privacy-pools/plugin.js'
import { getPpBalanceAndNotes } from '../privacy-pools/balance.js'
import { formatWei, txHashToHex } from './shared/format.js'

export async function runPpBalance(): Promise<void> {
  const env = loadEnv()
  const provider = await makeNodeProvider({ rpcUrl: env.SEPOLIA_RPC_URL, chain: sepolia })
  const host = makeHost({ provider, chain: sepolia, mnemonic: env.MNEMONIC, storagePath: PP_STORAGE_PATH, password: env.STORAGE_PASSWORD })
  const pools = createPools(host, 11155111)

  const { approved, pending, total, notes, history } = await getPpBalanceAndNotes(pools)

  console.log(`approved: ${formatWei(approved)}`)
  console.log(`pending:  ${formatWei(pending)}  (not yet ASP-approved; cannot be withdrawn, but can be ragequit)`)
  console.log(`total:    ${formatWei(total)}`)

  console.log(`\nnotes (${notes.length}):`)
  for (const n of notes) console.log(`  label=${n.label} value=${formatWei(n.value)} balance=${formatWei(n.balance)} approved=${n.approved}`)

  console.log(`\nhistory (${history.length}, newest first):`)
  for (const h of history) {
    console.log(`  [${h.type}] value=${formatWei(h.value)} block=${h.blockNumber} tx=${txHashToHex(h.transactionHash)}`)
  }
}
