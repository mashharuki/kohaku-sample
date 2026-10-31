import { describe, expect, it } from 'vitest'
import { makeNetwork } from '../../src/host/network.js'

function fakeFetch(responses: Record<string, Response>): typeof fetch {
  const calls: string[] = []
  const f = (async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    calls.push(url)
    const res = responses[url]
    if (!res) throw new Error(`no mock response for ${url}`)
    return res
  }) as typeof fetch
  ;(f as unknown as { calls: string[] }).calls = calls
  return f
}

describe('makeNetwork', () => {
  it('allows a request to an allowlisted host', async () => {
    const url = 'https://ipfs.filebase.io/some/path'
    const base = fakeFetch({ [url]: new Response('ok') })
    const network = makeNetwork(['ipfs.filebase.io'], base)
    const res = await network.fetch(url)
    expect(await res.text()).toBe('ok')
  })

  it('blocks a request to a host not in the allowlist, without calling the base fetch', async () => {
    let called = false
    const base = (async () => {
      called = true
      return new Response('should not happen')
    }) as typeof fetch
    const network = makeNetwork(['ipfs.filebase.io'], base)
    await expect(network.fetch('https://evil.example/collect')).rejects.toThrow(/blocked/)
    expect(called).toBe(false)
  })

  it('passes through real 4xx/5xx responses from allowlisted hosts instead of throwing', async () => {
    const url = 'https://ipfs.filebase.io/missing'
    const base = fakeFetch({ [url]: new Response('not found', { status: 404 }) })
    const network = makeNetwork(['ipfs.filebase.io'], base)
    const res = await network.fetch(url)
    expect(res.status).toBe(404)
  })

  it('accepts URL and Request inputs, matching on host', async () => {
    const base = fakeFetch({ 'https://ipfs.filebase.io/a': new Response('a') })
    const network = makeNetwork(['ipfs.filebase.io'], base)
    await expect(network.fetch(new URL('https://ipfs.filebase.io/a'))).resolves.toBeInstanceOf(Response)
    await expect(network.fetch(new Request('https://ipfs.filebase.io/a'))).resolves.toBeInstanceOf(Response)
  })
})
