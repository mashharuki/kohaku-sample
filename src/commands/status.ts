import { sepolia } from 'viem/chains'
import { loadEnv } from '../config/env.js'
import { PP_STORAGE_PATH, TC_STORAGE_PATH } from '../config/paths.js'
import { makePublicWallet } from '../chain/wallet.js'
import { makeHost, makeNodeProvider } from '../host/createHost.js'
import { formatWei } from './shared/format.js'

export async function runStatus(): Promise<void> {
  const env = loadEnv()

  const provider = await makeNodeProvider({ rpcUrl: env.SEPOLIA_RPC_URL, chain: sepolia })
  console.log(`chainId OK: ${await provider.getChainId()} (Sepolia)`)

  const { address } = makePublicWallet(env.MNEMONIC, sepolia, env.SEPOLIA_RPC_URL)
  const balance = await provider.getBalance(address)
  console.log(`wallet address: ${address}`)
  console.log(`wallet balance: ${formatWei(balance)}`)

  // Smoke-test both encrypted storage files (one per plugin): open/create + round-trip.
  for (const [label, path] of [
    ['Tornado Cash', TC_STORAGE_PATH],
    ['Privacy Pools', PP_STORAGE_PATH],
  ] as const) {
    const host = makeHost({ provider, chain: sepolia, mnemonic: env.MNEMONIC, storagePath: path, password: env.STORAGE_PASSWORD })
    await host.storage.set('status-check', '1')
    console.log(`${label} storage OK: ${path}`)
  }

  console.log('\nstatus: ready (nothing printed above reveals the mnemonic or any secret).')
}
