import {
  InsufficientBalanceError,
  KeystorePathNotAllowedError,
  PluginError,
  UnsupportedChainError,
} from '@kohaku-eth/plugins'
import { PPv1ExactOutputError } from '@kohaku-eth/privacy-pools'
import { describe, expect, it } from 'vitest'
import { ETH_ASSET } from '../../src/assets/eth.js'
import { toPpUserError } from '../../src/privacy-pools/errors.js'

describe('toPpUserError', () => {
  it('maps InsufficientBalanceError to an approved-vs-pending explanation with the amounts', () => {
    const e = new InsufficientBalanceError(ETH_ASSET, 100n, 10n)
    const msg = toPpUserError(e).message
    expect(msg).toMatch(/10/)
    expect(msg).toMatch(/100/)
    expect(msg).toMatch(/pending/i)
  })

  it('maps PPv1ExactOutputError to a fee/amount explanation', () => {
    const e = new PPv1ExactOutputError(100n, 90n)
    expect(toPpUserError(e).message).toMatch(/Fee too high/)
  })

  it('maps KeystorePathNotAllowedError to a plugin-specific message', () => {
    const e = new KeystorePathNotAllowedError("m/44'/60'/0'/0/0")
    expect(toPpUserError(e).message).toMatch(/Privacy Pools plugin/)
  })

  it('maps the Sepolia "no paymaster adapter" message to a ragequit suggestion', () => {
    const e = new Error('No paymaster adapter configured for pool')
    expect(toPpUserError(e).message).toMatch(/ragequit/)
  })

  it('passes through other PluginError subclasses unchanged', () => {
    const e = new UnsupportedChainError(1n)
    expect(toPpUserError(e)).toBe(e)
  })

  it('passes through an unrelated Error unchanged', () => {
    const e = new Error('network down')
    expect(toPpUserError(e)).toBe(e)
  })

  it('wraps a non-Error throw in an Error', () => {
    const result = toPpUserError(42)
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('42')
  })

  it('sanity: PluginError itself is still an Error (base class is matched before the generic fallback)', () => {
    const e = new PluginError('custom')
    expect(toPpUserError(e)).toBe(e)
  })
})
