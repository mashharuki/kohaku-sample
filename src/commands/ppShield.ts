import { sepolia } from 'viem/chains'
import { loadEnv } from '../config/env.js'
import { PP_STORAGE_PATH } from '../config/paths.js'
import { makePublicWallet, makeSendAndWait } from '../chain/wallet.js'
import { makeHost, makeNodeProvider } from '../host/createHost.js'
import { createPools } from '../privacy-pools/plugin.js'
import { executePpShield, planPpShield } from '../privacy-pools/shield.js'
import { confirmExecute, printDryRunNotice } from './shared/dryRun.js'
import { formatWei, parseEthAmount } from './shared/format.js'

type Options = { amount: string; execute: boolean }

export async function runPpShield(opts: Options): Promise<void> {
  const env = loadEnv()
  const amountWei = parseEthAmount(opts.amount)

  const provider = await makeNodeProvider({ rpcUrl: env.SEPOLIA_RPC_URL, chain: sepolia })
  const { address, signer } = makePublicWallet(env.MNEMONIC, sepolia, env.SEPOLIA_RPC_URL)
  const host = makeHost({ provider, chain: sepolia, mnemonic: env.MNEMONIC, storagePath: PP_STORAGE_PATH, password: env.STORAGE_PASSWORD })
  const pools = createPools(host, 11155111)

  const plan = await planPpShield(pools, amountWei)
  console.log(`from: ${address}`)
  console.log(`deposit: ${formatWei(plan.amountWei)}`)
  console.log(`vetting fee: ${formatWei(plan.quote.fee)} (bps=${plan.quote.vettingFeeBPS})`)
  console.log(`credited to note: ${formatWei(plan.quote.netAmount)}`)
  console.log(`minimum deposit: ${formatWei(plan.quote.minimumDeposit)}`)
  console.log('(network gas for the deposit tx itself is on top of the above and is not shown here.)')

  if (!opts.execute) {
    printDryRunNotice()
    return
  }

  const ok = await confirmExecute(`About to deposit ${formatWei(plan.amountWei)} into Privacy Pools (Sepolia).`)
  if (!ok) {
    console.log('Aborted.')
    return
  }

  const sendAndWait = makeSendAndWait(provider, signer)
  const receipts = await executePpShield(plan, sendAndWait)
  for (const r of receipts) console.log(`deposit tx confirmed: ${r.hash}`)
  console.log('Done. Check `pp:balance` — it will likely show as pending until the ASP approves it.')
}
