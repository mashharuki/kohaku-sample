import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Host } from '@kohaku-eth/plugins'
import { TORNADO_CIRCUIT_SHA256, TORNADO_PROVING_KEY_SHA256 } from '@kohaku-eth/tornado-cash'

// @kohaku-eth/tornado-cash declares ITornadoArtifacts but does not export it; mirrored here
// from its artifactsLoader signature ({ circuitText: string; provingKey: ArrayBuffer }).
export type TornadoArtifacts = { circuitText: string; provingKey: ArrayBuffer }

// Same pinned tornado-cli commit the SDK's own (unexported) defaultArtifactsLoader fetches —
// see @kohaku-eth/tornado-cash dist/index.js. The SDK's default loader uses the raw global
// fetch, bypassing host.network.fetch (and its allowlist) entirely. We fetch through
// host.network.fetch instead, so the one-time download is allowlisted and auditable, and we
// cache the bytes locally afterwards so it only ever happens once. If a future SDK release
// re-pins a different commit, the sha256 check below still catches any mismatch loudly.
const BASE_URL =
  'https://raw.githubusercontent.com/tornadocash/tornado-cli/378ddf8b8b92a4924037d7b64a94dbfd5a7dd6e8/build/circuits'
const CIRCUIT_URL = `${BASE_URL}/tornado.json`
const PROVING_KEY_URL = `${BASE_URL}/tornadoProvingKey.bin`

type CacheFile = { circuitText: string; provingKeyBase64: string }

function sha256Hex(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex')
}

/**
 * `Buffer.buffer` is the whole underlying ArrayBuffer, not just this Buffer's view into it —
 * for a small Buffer (e.g. one decoded from base64), Node allocates it from an internal 8 KiB
 * pool, so `.buffer` would otherwise return that entire pool chunk (unrelated heap bytes
 * included) instead of just the proving key.
 */
function toOwnArrayBuffer(buf: Buffer): ArrayBuffer {
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength).slice().buffer
}

function verify(label: string, data: Buffer, expectedHex: string) {
  const actual = sha256Hex(data)
  if (actual !== expectedHex) {
    throw new Error(
      `${label} failed integrity check: expected sha256 ${expectedHex}, got ${actual}. Refusing to use it.`,
    )
  }
}

/**
 * Downloads Tornado's proving artifacts through host.network.fetch exactly once, verifies
 * them against the SDK's own TORNADO_CIRCUIT_SHA256 / TORNADO_PROVING_KEY_SHA256 constants,
 * and caches them locally (cachePath) for every later run.
 */
export function makeCachedArtifactsLoader(
  host: Host,
  cachePath: string,
): () => Promise<TornadoArtifacts> {
  return async () => {
    if (existsSync(cachePath)) {
      const cached = JSON.parse(readFileSync(cachePath, 'utf8')) as CacheFile
      return {
        circuitText: cached.circuitText,
        provingKey: toOwnArrayBuffer(Buffer.from(cached.provingKeyBase64, 'base64')),
      }
    }

    const [circuitRes, provingKeyRes] = await Promise.all([
      host.network.fetch(CIRCUIT_URL),
      host.network.fetch(PROVING_KEY_URL),
    ])
    if (!circuitRes.ok)
      throw new Error(`Failed to fetch Tornado circuit: HTTP ${circuitRes.status}`)
    if (!provingKeyRes.ok)
      throw new Error(`Failed to fetch Tornado proving key: HTTP ${provingKeyRes.status}`)

    const circuitText = await circuitRes.text()
    const provingKeyBuf = Buffer.from(await provingKeyRes.arrayBuffer())

    verify('Tornado circuit', Buffer.from(circuitText, 'utf8'), TORNADO_CIRCUIT_SHA256)
    verify('Tornado proving key', provingKeyBuf, TORNADO_PROVING_KEY_SHA256)

    mkdirSync(dirname(cachePath), { recursive: true })
    writeFileSync(
      cachePath,
      JSON.stringify({
        circuitText,
        provingKeyBase64: provingKeyBuf.toString('base64'),
      } satisfies CacheFile),
    )

    return { circuitText, provingKey: toOwnArrayBuffer(provingKeyBuf) }
  }
}
