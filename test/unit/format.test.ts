import { describe, expect, it } from 'vitest'
import {
  formatWei,
  parseEthAmount,
  shortAddress,
  txHashToHex,
} from '../../src/commands/shared/format.js'

describe('formatWei', () => {
  it('formats wei as ETH', () => {
    expect(formatWei(1_000_000_000_000_000_000n)).toBe('1 ETH')
    expect(formatWei(0n)).toBe('0 ETH')
  })
})

describe('parseEthAmount', () => {
  it('parses a decimal ETH string into wei', () => {
    expect(parseEthAmount('1')).toBe(1_000_000_000_000_000_000n)
    expect(parseEthAmount('0.1')).toBe(100_000_000_000_000_000n)
  })

  it('round-trips through formatWei', () => {
    expect(formatWei(parseEthAmount('0.01'))).toBe('0.01 ETH')
  })
})

describe('txHashToHex', () => {
  it('reports unknown for the 0n sentinel (state-snapshot-sourced entries)', () => {
    expect(txHashToHex(0n)).toMatch(/unknown/)
  })

  it('renders a real hash as 32-byte left-padded hex', () => {
    expect(txHashToHex(0x1234n)).toBe(`0x${'0'.repeat(60)}1234`)
  })
})

describe('shortAddress', () => {
  it('keeps the 0x + first 4 hex chars and the last 4 chars', () => {
    expect(shortAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe('0x1234…5678')
  })
})
