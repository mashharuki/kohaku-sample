import { sepolia } from 'viem/chains'
import { loadEnv } from '../config/env.js'
import { TC_ARTIFACTS_CACHE_PATH, TC_STORAGE_PATH } from '../config/paths.js'
import type { Hex } from '../assets/eth.js'
import { makeHost, makeNodeProvider } from '../host/createHost.js'
import { createTornado } from '../tornado/plugin.js'
import { makeCachedArtifactsLoader } from '../tornado/artifacts.js'
import { executeTcUnshield, previewTcUnshield } from '../tornado/unshield.js'
import { confirmExecute, printDryRunNotice } from './shared/dryRun.js'
import { formatWei, parseEthAmount } from './shared/format.js'

type Options = { to: Hex; amount: string; strict: boolean; callGasCeiling?: string; execute: boolean }

export async function runTcUnshield(opts: Options): Promise<void> {
  const env = loadEnv()
  const amountWei = parseEthAmount(opts.amount)

  const provider = await makeNodeProvider({ rpcUrl: env.SEPOLIA_RPC_URL, chain: sepolia })
  const host = makeHost({ provider, chain: sepolia, mnemonic: env.MNEMONIC, storagePath: TC_STORAGE_PATH, password: env.STORAGE_PASSWORD })
  const tornado = createTornado(host, 11155111, makeCachedArtifactsLoader(host, TC_ARTIFACTS_CACHE_PATH))

  const preview = previewTcUnshield(opts.to, amountWei)
  console.log(`recipient: ${preview.recipient}`)
  console.log(`amount: ${formatWei(preview.amountWei)} (paymaster-sponsored; recipient needs no ETH for gas)`)
  console.log(preview.note)
  if (!opts.callGasCeiling) {
    console.warn('warning: no --call-gas-ceiling set — an untrusted bundler could raise the sponsored fee up to what the note affords.')
  }

  if (!opts.execute) {
    printDryRunNotice()
    return
  }

  const ok = await confirmExecute(
    `About to send ${formatWei(amountWei)} from Tornado Cash notes to ${opts.to} via the paymaster. The real fee will only be known once this is submitted.`,
  )
  if (!ok) {
    console.log('Aborted.')
    return
  }

  const { fees, fallback, receipts } = await executeTcUnshield(host, tornado, opts.to, amountWei, {
    strict: opts.strict,
    callGasCeiling: opts.callGasCeiling ? BigInt(opts.callGasCeiling) : undefined,
  })
  console.log(`withdrawal fee(s): ${fees.map(formatWei).join(', ')}`)
  if (fallback) console.warn('warning: at least one withdrawal used fallback (unestimated) gas limits.')
  for (const r of receipts) console.log(`submitted: userOpHash=${r.id}`)
}
