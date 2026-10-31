import { sepolia } from 'viem/chains'
import { loadEnv } from '../config/env.js'
import { PP_STORAGE_PATH } from '../config/paths.js'
import { makePublicWallet, makeSendAndWait } from '../chain/wallet.js'
import { makeHost, makeNodeProvider } from '../host/createHost.js'
import { createPools } from '../privacy-pools/plugin.js'
import { executeRagequit, planRagequit } from '../privacy-pools/ragequit.js'
import { confirmExecute, printDryRunNotice } from './shared/dryRun.js'
import { formatWei } from './shared/format.js'

type Options = { execute: boolean }

export async function runPpRagequit(opts: Options): Promise<void> {
  const env = loadEnv()
  const provider = await makeNodeProvider({ rpcUrl: env.SEPOLIA_RPC_URL, chain: sepolia })
  const { address, signer } = makePublicWallet(env.MNEMONIC, sepolia, env.SEPOLIA_RPC_URL)
  const host = makeHost({ provider, chain: sepolia, mnemonic: env.MNEMONIC, storagePath: PP_STORAGE_PATH, password: env.STORAGE_PASSWORD })
  const pools = createPools(host, 11155111)

  console.log(
    'Ragequit is a PUBLIC withdrawal back to the depositor address — it provides no privacy. ' +
      'This app checks only one ASP source (the default IPFS gateway); a dishonest ASP could make an ' +
      'already-approved deposit look pending. Do not rely on this alone for anything beyond testing.',
  )

  const plan = await planRagequit(pools)
  if (plan.pendingNotes.length === 0) {
    console.log('No pending (unapproved) notes to ragequit.')
    return
  }

  console.log(`pending notes to ragequit (${plan.pendingNotes.length}), returning to ${address}:`)
  for (const n of plan.pendingNotes) console.log(`  label=${n.label} value=${formatWei(n.value)}`)

  if (!opts.execute) {
    printDryRunNotice()
    return
  }

  const ok = await confirmExecute(`About to publicly ragequit ${plan.pendingNotes.length} note(s) back to ${address}.`)
  if (!ok) {
    console.log('Aborted.')
    return
  }

  const sendAndWait = makeSendAndWait(provider, signer)
  const receipts = await executeRagequit(plan, sendAndWait)
  for (const r of receipts) console.log(`ragequit tx confirmed: ${r.hash}`)
}
