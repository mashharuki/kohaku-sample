// Funds-safety: notes are re-derived from the keystore, never stored. If this ever stops
// being deterministic, a wallet restart makes existing notes unspendable.
import { KeystorePathNotAllowedError, MnemonicKeystore, scopeKeystore } from '@kohaku-eth/plugins'
import { describe, expect, it } from 'vitest'

const TEST_MNEMONIC = 'test test test test test test test test test test test junk'

describe('MnemonicKeystore', () => {
  it('is deterministic across instances (notes re-derive after a restart)', async () => {
    const a = new MnemonicKeystore(TEST_MNEMONIC)
    const b = new MnemonicKeystore(TEST_MNEMONIC)
    expect(await a.deriveAt("m/28784'/1'/0'")).toBe(await b.deriveAt("m/28784'/1'/0'"))
  })

  it('derives different keys for different accounts/paths', async () => {
    const k = new MnemonicKeystore(TEST_MNEMONIC)
    expect(await k.deriveAt("m/28784'/1'/0'")).not.toBe(await k.deriveAt("m/28784'/1'/1'"))
  })
})

describe('scopeKeystore', () => {
  it('refuses paths outside the plugin prefix', async () => {
    const scoped = scopeKeystore(new MnemonicKeystore(TEST_MNEMONIC), { prefixes: ["m/29795'/1'"] })
    await expect(scoped.deriveAt("m/44'/60'/0'/0/0")).rejects.toBeInstanceOf(
      KeystorePathNotAllowedError,
    )
  })

  it('allows paths under the scoped prefix', async () => {
    const scoped = scopeKeystore(new MnemonicKeystore(TEST_MNEMONIC), { prefixes: ["m/29795'/1'"] })
    await expect(scoped.deriveAt("m/29795'/1'/0'")).resolves.toMatch(/^0x[0-9a-f]{64}$/)
  })
})
