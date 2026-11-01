import type { Host } from '@kohaku-eth/plugins'
import { createPPv1Plugin, PrivacyPoolsV1_0xBow } from '@kohaku-eth/privacy-pools'

// Required by the plugin constructor even though this sample never uses paymaster/relayer
// unshield on Sepolia (only ragequit, which is a plain public tx). Any reachable relayer URL
// works; it is simply never called.
const BROADCASTER_URL = 'https://fastrelay.xyz/relayer'

export function createPools(host: Host, chainId: 1 | 11155111, accountIndex = 0) {
  const d = PrivacyPoolsV1_0xBow[chainId]
  return createPPv1Plugin(host, {
    accountIndex,
    broadcasterUrl: BROADCASTER_URL,
    entrypoint: {
      address: BigInt(d.entrypoint.entrypointAddress),
      deploymentBlock: d.entrypoint.deploymentBlock,
    },
    // aspServiceFactory intentionally omitted: use the plugin's default IPFSAspService,
    // which correctly routes through host.network.fetch (verified against SDK source).
  })
}

export type Pools = ReturnType<typeof createPools>
