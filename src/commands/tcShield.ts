import { sepolia } from 'viem/chains'
import { loadEnv } from '../config/env.js'
import { TC_ARTIFACTS_CACHE_PATH, TC_STORAGE_PATH } from '../config/paths.js'
import { makePublicWallet, makeSendAndWait } from '../chain/wallet.js'
import { makeHost, makeNodeProvider } from '../host/createHost.js'
import { createTornado } from '../tornado/plugin.js'
import { makeCachedArtifactsLoader } from '../tornado/artifacts.js'
import { executeTcShield, parseStrategy, planTcShield } from '../tornado/shield.js'
import { confirmExecute, printDryRunNotice } from './shared/dryRun.js'
import { formatWei, parseEthAmount } from './shared/format.js'

type Options = { amount: string; strategy: string; execute: boolean }

export async function runTcShield(opts: Options): Promise<void> {
  const env = loadEnv()
  const amountWei = parseEthAmount(opts.amount)
  const strategy = parseStrategy(opts.strategy)

  const provider = await makeNodeProvider({ rpcUrl: env.SEPOLIA_RPC_URL, chain: sepolia })
  const { address, signer } = makePublicWallet(env.MNEMONIC, sepolia, env.SEPOLIA_RPC_URL)
  const host = makeHost({ provider, chain: sepolia, mnemonic: env.MNEMONIC, storagePath: TC_STORAGE_PATH, password: env.STORAGE_PASSWORD })
  const tornado = createTornado(host, 11155111, makeCachedArtifactsLoader(host, TC_ARTIFACTS_CACHE_PATH))

  const plan = await planTcShield(tornado, amountWei, strategy)
  if (plan.remainder !== 0n) {
    console.error(
      `Requested ${formatWei(plan.requested)} but only ${formatWei(plan.deposited)} fits the live pool denominations; ` +
        `${formatWei(plan.remainder)} would be silently dropped. Pick an amount that is an exact sum of denominations (e.g. 0.1 ETH).`,
    )
    process.exitCode = 1
    return
  }

  console.log(`from: ${address}`)
  console.log(`deposit: ${formatWei(plan.deposited)} across ${plan.txns.length} note(s)`)

  if (!opts.execute) {
    printDryRunNotice()
    return
  }

  const ok = await confirmExecute(`About to send ${plan.txns.length} deposit transaction(s) totalling ${formatWei(plan.deposited)} to Tornado Cash (Sepolia).`)
  if (!ok) {
    console.log('Aborted.')
    return
  }

  const sendAndWait = makeSendAndWait(provider, signer)
  const receipts = await executeTcShield(plan, sendAndWait)
  for (const r of receipts) console.log(`deposit tx confirmed: ${r.hash}`)
  console.log('Done. Check `tc:notes` to see the new note(s).')
}
