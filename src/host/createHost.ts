import { MnemonicKeystore, type Host } from '@kohaku-eth/plugins'
import type { EthereumProvider } from '@kohaku-eth/provider'
import { viem } from '@kohaku-eth/provider/viem'
import { createPublicClient, http, type Chain } from 'viem'
import { assertSepoliaChainId } from '../chain/guard.js'
import { buildAllowedHosts } from './allowlist.js'
import { withChunkedGetLogs } from './chunkedProvider.js'
import { makeNetwork } from './network.js'
import { makeEncryptedFileStorage } from './storage.js'

export type NodeProviderOptions = {
  rpcUrl: string
  chain: Chain
}

/** Builds the chunked-getLogs provider and verifies its chainId once, shared by both plugin Hosts. */
export async function makeNodeProvider(o: NodeProviderOptions): Promise<EthereumProvider> {
  const rawProvider = viem(createPublicClient({ chain: o.chain, transport: http(o.rpcUrl) }))
  const provider = withChunkedGetLogs(rawProvider)
  await assertSepoliaChainId(provider)
  return provider
}

export type HostOptions = {
  provider: EthereumProvider
  chain: Chain
  mnemonic: string
  storagePath: string
  password: string
}

/** Builds one Host for one plugin. Each plugin gets its own storage file (see src/config/paths.ts). */
export function makeHost(o: HostOptions): Host {
  return {
    network: makeNetwork(buildAllowedHosts(o.chain.id)),
    storage: makeEncryptedFileStorage(o.storagePath, o.password),
    keystore: new MnemonicKeystore(o.mnemonic),
    provider: o.provider,
  }
}
