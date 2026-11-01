import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Host } from '@kohaku-eth/plugins'
import { TORNADO_CIRCUIT_SHA256, TORNADO_PROVING_KEY_SHA256 } from '@kohaku-eth/tornado-cash'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeCachedArtifactsLoader } from '../../src/tornado/artifacts.js'

let dir: string
let cachePath: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'kohaku-artifacts-test-'))
  cachePath = join(dir, 'tc-artifacts.json')
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

// The pinned sha256 constants are fixed SDK values, so there's no payload we can serve here
// that actually matches them; these tests exercise the mismatch/error paths and the cache-hit
// path, not a successful fresh download.
function mockHost(responses: { circuit: Response; provingKey: Response }): Host {
  const fetchImpl = vi.fn(async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url.endsWith('tornado.json')) return responses.circuit
    if (url.endsWith('tornadoProvingKey.bin')) return responses.provingKey
    throw new Error(`unexpected fetch ${url}`)
  })
  return { network: { fetch: fetchImpl } } as unknown as Host
}

describe('makeCachedArtifactsLoader', () => {
  it('rejects a circuit payload that does not match the pinned sha256', async () => {
    const host = mockHost({
      circuit: new Response('not the real circuit', { status: 200 }),
      provingKey: new Response(new ArrayBuffer(8), { status: 200 }),
    })
    const loader = makeCachedArtifactsLoader(host, cachePath)
    await expect(loader()).rejects.toThrow(/integrity check/)
  })

  it('propagates an HTTP error fetching the circuit', async () => {
    const host = mockHost({
      circuit: new Response('not found', { status: 404 }),
      provingKey: new Response(new ArrayBuffer(8), { status: 200 }),
    })
    const loader = makeCachedArtifactsLoader(host, cachePath)
    await expect(loader()).rejects.toThrow(/Failed to fetch Tornado circuit: HTTP 404/)
  })

  it('fetches through host.network.fetch rather than the global fetch (allowlist respected)', async () => {
    const host = mockHost({
      circuit: new Response('x', { status: 200 }),
      provingKey: new Response(new ArrayBuffer(8), { status: 200 }),
    })
    const loader = makeCachedArtifactsLoader(host, cachePath)
    await expect(loader()).rejects.toThrow() // wrong hash, but that's fine — we're asserting the channel used
    expect(host.network.fetch).toHaveBeenCalledWith(
      expect.stringContaining('raw.githubusercontent.com'),
    )
  })

  it('serves from the local cache on a later call without fetching again', async () => {
    const seeded = {
      circuitText: 'cached-circuit',
      provingKeyBase64: Buffer.from('cached-key').toString('base64'),
    }
    writeFileSync(cachePath, JSON.stringify(seeded))

    const fetchImpl = vi.fn()
    const host = { network: { fetch: fetchImpl } } as unknown as Host
    const loader = makeCachedArtifactsLoader(host, cachePath)

    const result = await loader()
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(result.circuitText).toBe('cached-circuit')
    expect(Buffer.from(result.provingKey).toString()).toBe('cached-key')
  })

  it('sanity: the pinned sha256 constants are 64-char hex (used as-is by verify())', () => {
    expect(TORNADO_CIRCUIT_SHA256).toMatch(/^[0-9a-f]{64}$/)
    expect(TORNADO_PROVING_KEY_SHA256).toMatch(/^[0-9a-f]{64}$/)
  })
})
