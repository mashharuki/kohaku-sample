import type { ERC20AssetId } from '@kohaku-eth/plugins'

export type Hex = `0x${string}`

// @kohaku-eth/plugins does not export E_ADDRESS itself; @kohaku-eth/privacy-pools and
// @kohaku-eth/tornado-cash each export the identical literal independently. Kept here as a
// plain constant so this shared module doesn't have to depend on either protocol package.
export const E_ADDRESS: Hex = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'

/** ETH is represented as the ERC-20 sentinel { __type: 'erc20', contract: E_ADDRESS }. `__type: 'native'` is rejected. */
export const ETH_ASSET: ERC20AssetId = { __type: 'erc20', contract: E_ADDRESS }

export function ethAmount(amount: bigint) {
  return { asset: ETH_ASSET, amount }
}

/** Tornado Cash's notes() reports ETH as assetAddress 0n, not the E_ADDRESS sentinel used on input. */
export function isEthAssetAddress(assetAddress: bigint): boolean {
  return assetAddress === 0n
}
