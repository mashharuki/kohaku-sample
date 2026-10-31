import { describe, expect, it } from 'vitest'
import { E_ADDRESS, ETH_ASSET, ethAmount, isEthAssetAddress } from '../../src/assets/eth.js'

describe('ETH asset representation', () => {
  it('ETH_ASSET is the erc20 sentinel, never the native type', () => {
    expect(ETH_ASSET).toEqual({ __type: 'erc20', contract: E_ADDRESS })
  })

  it('ethAmount pairs ETH_ASSET with the given wei amount', () => {
    expect(ethAmount(123n)).toEqual({ asset: ETH_ASSET, amount: 123n })
  })

  it('isEthAssetAddress recognizes only the 0n sentinel used by Tornado notes()', () => {
    expect(isEthAssetAddress(0n)).toBe(true)
    expect(isEthAssetAddress(1n)).toBe(false)
    expect(isEthAssetAddress(BigInt(E_ADDRESS))).toBe(false)
  })
})
