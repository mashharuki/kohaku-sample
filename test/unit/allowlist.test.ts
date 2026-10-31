import { TornadoPaymasterConfigs } from '@kohaku-eth/tornado-cash'
import { describe, expect, it } from 'vitest'
import { buildAllowedHosts } from '../../src/host/allowlist.js'

describe('buildAllowedHosts', () => {
  it('always includes the PP IPFS ASP gateway and the Tornado artifacts host', () => {
    const hosts = buildAllowedHosts(11155111)
    expect(hosts).toContain('ipfs.filebase.io')
    expect(hosts).toContain('raw.githubusercontent.com')
  })

  it('includes the Sepolia TC bundler host derived from the SDK config', () => {
    const hosts = buildAllowedHosts(11155111)
    const expectedHost = new URL(TornadoPaymasterConfigs[11155111].bundlerUrl).host
    expect(hosts).toContain(expectedHost)
  })

  it('defaults to Sepolia when no chain id is given', () => {
    expect(buildAllowedHosts()).toEqual(buildAllowedHosts(11155111))
  })

  it('does not add a bundler host for a chain with no TC paymaster config', () => {
    const hosts = buildAllowedHosts(999999)
    expect(hosts).toEqual(['ipfs.filebase.io', 'raw.githubusercontent.com'])
  })

  it('returns no duplicate hosts', () => {
    const hosts = buildAllowedHosts(11155111)
    expect(new Set(hosts).size).toBe(hosts.length)
  })
})
