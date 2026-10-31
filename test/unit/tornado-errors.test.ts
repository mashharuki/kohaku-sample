import { InsufficientBalanceError, KeystorePathNotAllowedError } from '@kohaku-eth/plugins'
import { TornadoArtifactsIntegrityError } from '@kohaku-eth/tornado-cash'
import { describe, expect, it } from 'vitest'
import { ETH_ASSET } from '../../src/assets/eth.js'
import { toTornadoUserError } from '../../src/tornado/errors.js'

describe('toTornadoUserError', () => {
  it('maps InsufficientBalanceError to a UI message pointing at tc:notes', () => {
    const e = new InsufficientBalanceError(ETH_ASSET, 100n, 10n)
    expect(toTornadoUserError(e).message).toMatch(/tc:notes/)
  })

  it('matches the plain Error the worker throws for insufficient notes (alpha.32 behavior)', () => {
    const e = new Error('Insufficient balance for withdrawal')
    expect(toTornadoUserError(e).message).toMatch(/tc:notes/)
  })

  it('maps TornadoArtifactsIntegrityError to an actionable message', () => {
    const e = new TornadoArtifactsIntegrityError('circuit', 'expectedHash', 'actualHash')
    expect(toTornadoUserError(e).message).toMatch(/integrity check/)
  })

  it('maps KeystorePathNotAllowedError to a plugin-specific message', () => {
    const e = new KeystorePathNotAllowedError("m/44'/60'/0'/0/0")
    expect(toTornadoUserError(e).message).toMatch(/Tornado Cash plugin/)
  })

  it('passes through an unrelated Error unchanged', () => {
    const e = new Error('network down')
    expect(toTornadoUserError(e)).toBe(e)
  })

  it('wraps a non-Error throw in an Error', () => {
    const result = toTornadoUserError('oops')
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('oops')
  })
})
