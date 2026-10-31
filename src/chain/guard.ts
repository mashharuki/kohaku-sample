import type { EthereumProvider } from '@kohaku-eth/provider'

export const SEPOLIA_CHAIN_ID = 11155111n

/**
 * This sample is Sepolia-only by design (test funds only). Any other chain id — mainnet
 * included — aborts immediately, before any plugin, storage, or wallet code runs.
 */
export async function assertSepoliaChainId(provider: EthereumProvider): Promise<void> {
  const chainId = await provider.getChainId()
  if (chainId !== SEPOLIA_CHAIN_ID) {
    console.error(
      `Refusing to run: configured RPC reports chainId ${chainId}, expected Sepolia (${SEPOLIA_CHAIN_ID}).\n` +
        'This sample only ever talks to Sepolia test ETH. Check SEPOLIA_RPC_URL in your .env.',
    )
    process.exit(1)
  }
}
