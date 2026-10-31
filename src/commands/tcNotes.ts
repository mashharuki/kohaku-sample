import { sepolia } from 'viem/chains'
import { loadEnv } from '../config/env.js'
import { TC_ARTIFACTS_CACHE_PATH, TC_STORAGE_PATH } from '../config/paths.js'
import { makeHost, makeNodeProvider } from '../host/createHost.js'
import { createTornado } from '../tornado/plugin.js'
import { makeCachedArtifactsLoader } from '../tornado/artifacts.js'
import { getTcBalanceAndNotes } from '../tornado/notes.js'
import { formatWei } from './shared/format.js'

type Options = { includeSpent: boolean }

export async function runTcNotes(opts: Options): Promise<void> {
  const env = loadEnv()
  const provider = await makeNodeProvider({ rpcUrl: env.SEPOLIA_RPC_URL, chain: sepolia })
  const host = makeHost({ provider, chain: sepolia, mnemonic: env.MNEMONIC, storagePath: TC_STORAGE_PATH, password: env.STORAGE_PASSWORD })
  const tornado = createTornado(host, 11155111, makeCachedArtifactsLoader(host, TC_ARTIFACTS_CACHE_PATH))

  const { balance, notes } = await getTcBalanceAndNotes(tornado, opts.includeSpent)

  console.log('balance:')
  for (const row of balance) console.log(`  ${formatWei(row.amount)}`)

  console.log(`notes (${notes.length}):`)
  for (const n of notes) {
    console.log(`  pool=${n.pool} amount=${formatWei(n.amount)} balance=${formatWei(n.balance)} eth=${n.isEth} leafIndex=${n.leafIndex}`)
  }
  // Note strings / commitments that could be used to re-derive a secret are intentionally never printed.
}
