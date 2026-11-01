import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'
import type { Storage } from '@kohaku-eth/plugins'

const GZIP_THRESHOLD_BYTES = 64 * 1024

type Envelope = { salt: string; iv: string; tag: string; data: string; gzip: boolean }

/**
 * AES-256-GCM encrypted file storage, one file per plugin. Values over 64 KiB are gzipped
 * before encryption (large pool state can otherwise be slow to encrypt/decrypt). Writes are
 * atomic (write to a temp file, then rename) so a crash mid-write cannot corrupt the store;
 * set() never partially persists.
 */
export function makeEncryptedFileStorage(path: string, password: string): Storage {
  if (!password) throw new Error('makeEncryptedFileStorage: empty password')
  mkdirSync(dirname(path), { recursive: true })

  let salt = randomBytes(16)
  let store: Record<string, string> = {}

  if (existsSync(path)) {
    const raw = readFileSync(path, 'utf8')
    const env = JSON.parse(raw) as Envelope
    salt = Buffer.from(env.salt, 'base64')
    const key = scryptSync(password, salt, 32)
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(env.iv, 'base64'))
    decipher.setAuthTag(Buffer.from(env.tag, 'base64'))
    let plain = Buffer.concat([decipher.update(Buffer.from(env.data, 'base64')), decipher.final()])
    if (env.gzip) plain = gunzipSync(plain)
    store = JSON.parse(plain.toString('utf8')) as Record<string, string>
  }

  const key = scryptSync(password, salt, 32)

  function persist() {
    const serialized = Buffer.from(JSON.stringify(store), 'utf8')
    const gzip = serialized.byteLength > GZIP_THRESHOLD_BYTES
    const plain = gzip ? gzipSync(serialized) : serialized
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const data = Buffer.concat([cipher.update(plain), cipher.final()])
    const env: Envelope = {
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      data: data.toString('base64'),
      gzip,
    }
    const tmpPath = `${path}.tmp-${process.pid}-${Date.now()}`
    writeFileSync(tmpPath, JSON.stringify(env))
    renameSync(tmpPath, path)
  }

  return {
    _brand: 'Storage',
    async get(k) {
      return store[k] ?? null
    },
    async set(k, v) {
      const prev = store[k]
      store[k] = v
      try {
        persist()
      } catch (e) {
        if (prev === undefined) delete store[k]
        else store[k] = prev
        throw e instanceof Error ? e : new Error(String(e))
      }
    },
  }
}
