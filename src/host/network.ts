import type { Host } from '@kohaku-eth/plugins'

/**
 * Allowlisted host.network.fetch. Returns real 4xx/5xx Responses as-is (plugins check
 * response.ok themselves); only throws when a host is blocked or the request itself fails.
 */
export function makeNetwork(allowedHosts: readonly string[], baseFetch: typeof fetch = globalThis.fetch): Host['network'] {
  const allowed = new Set(allowedHosts)
  return {
    async fetch(input, init) {
      const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const host = new URL(href).host
      if (!allowed.has(host)) throw new Error(`network.fetch blocked (not in allowlist): ${host}`)
      return baseFetch(input, init)
    },
  }
}
