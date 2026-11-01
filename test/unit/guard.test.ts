import type { EthereumProvider } from '@kohaku-eth/provider'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assertSepoliaChainId, SEPOLIA_CHAIN_ID } from '../../src/chain/guard.js'

function providerWithChainId(chainId: bigint): EthereumProvider {
  return { getChainId: async () => chainId } as unknown as EthereumProvider
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('assertSepoliaChainId', () => {
  it('resolves without exiting when the provider reports Sepolia', async () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as unknown as typeof process.exit)
    await assertSepoliaChainId(providerWithChainId(SEPOLIA_CHAIN_ID))
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('exits with code 1 and explains why when the chain id is not Sepolia', async () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as unknown as typeof process.exit)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await assertSepoliaChainId(providerWithChainId(1n))
    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('chainId 1'))
  })
})
