import { TornadoPaymasterConfigs } from '@kohaku-eth/tornado-cash'

const SEPOLIA_CHAIN_ID = 11155111

/** Default IPFS gateway used by @kohaku-eth/privacy-pools' IPFSAspService when no aspServiceFactory is supplied. */
const PP_DEFAULT_IPFS_GATEWAY_HOST = 'ipfs.filebase.io'

/**
 * Pinned GitHub commit the Tornado Cash plugin's artifacts are fetched from. The SDK's own
 * default artifactsLoader uses the raw global fetch (bypassing host.network.fetch entirely),
 * so we implement our own loader (see src/tornado/artifacts.ts) that fetches through
 * host.network.fetch instead, once, and caches the result locally. This host must stay
 * allowlisted for that one-time download.
 */
const TORNADO_ARTIFACTS_HOST = 'raw.githubusercontent.com'

/**
 * Hosts this sample's host.network.fetch is allowed to contact, derived from the SDK's own
 * resolved config rather than hardcoded guesses (bundler URLs in particular are an SDK
 * implementation detail that can change between alpha releases).
 */
export function buildAllowedHosts(chainId: number = SEPOLIA_CHAIN_ID): string[] {
  const hosts = new Set<string>()
  hosts.add(PP_DEFAULT_IPFS_GATEWAY_HOST)
  hosts.add(TORNADO_ARTIFACTS_HOST)

  const tcPaymaster = (TornadoPaymasterConfigs as Record<number, { bundlerUrl: string }>)[chainId]
  if (tcPaymaster) hosts.add(new URL(tcPaymaster.bundlerUrl).host)

  return [...hosts]
}
