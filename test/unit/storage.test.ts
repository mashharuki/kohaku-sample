import { chmodSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeEncryptedFileStorage } from '../../src/host/storage.js'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'kohaku-storage-test-'))
})

afterEach(() => {
  chmodSync(dir, 0o700)
  rmSync(dir, { recursive: true, force: true })
})

describe('makeEncryptedFileStorage', () => {
  it('rejects an empty password', () => {
    expect(() => makeEncryptedFileStorage(join(dir, 'store.enc.json'), '')).toThrow(
      /empty password/,
    )
  })

  it('returns null for a missing key and round-trips a value within one instance', async () => {
    const storage = makeEncryptedFileStorage(join(dir, 'store.enc.json'), 'correct-password')
    expect(await storage.get('missing')).toBeNull()
    await storage.set('k', '{"a":1}')
    expect(await storage.get('k')).toBe('{"a":1}')
  })

  it('persists to disk and reopens with the same password', async () => {
    const path = join(dir, 'store.enc.json')
    const first = makeEncryptedFileStorage(path, 'correct-password')
    await first.set('pp-state', '{"balance":"100"}')

    const second = makeEncryptedFileStorage(path, 'correct-password')
    expect(await second.get('pp-state')).toBe('{"balance":"100"}')
  })

  it('round-trips a large (gzipped) value', async () => {
    const path = join(dir, 'store.enc.json')
    const big = JSON.stringify({ data: 'x'.repeat(200_000) })
    const first = makeEncryptedFileStorage(path, 'correct-password')
    await first.set('big', big)

    const second = makeEncryptedFileStorage(path, 'correct-password')
    expect(await second.get('big')).toBe(big)
  })

  it('fails to decrypt with the wrong password', async () => {
    const path = join(dir, 'store.enc.json')
    const first = makeEncryptedFileStorage(path, 'correct-password')
    await first.set('k', 'v')

    expect(() => makeEncryptedFileStorage(path, 'wrong-password')).toThrow()
  })

  it('rolls back the in-memory value if persisting fails, without corrupting the on-disk file', async () => {
    const path = join(dir, 'store.enc.json')
    const storage = makeEncryptedFileStorage(path, 'correct-password')
    await storage.set('k', 'original')

    // Make the directory read-only so the atomic tmp-file write fails; set() must restore
    // the previous in-memory value and propagate the error rather than leaving state updated
    // but unpersisted.
    chmodSync(dir, 0o500)
    try {
      await expect(storage.set('k', 'new-value-that-should-not-stick')).rejects.toThrow()
    } finally {
      chmodSync(dir, 0o700)
    }
    expect(await storage.get('k')).toBe('original')

    const reopened = makeEncryptedFileStorage(path, 'correct-password')
    expect(await reopened.get('k')).toBe('original')
  })

  it('rolls back a new key to absent if its first persist fails', async () => {
    const path = join(dir, 'store.enc.json')
    const storage = makeEncryptedFileStorage(path, 'correct-password')
    await storage.set('seed', 'v') // ensure the file exists before locking the directory

    chmodSync(dir, 0o500)
    try {
      await expect(storage.set('brand-new-key', 'v')).rejects.toThrow()
    } finally {
      chmodSync(dir, 0o700)
    }
    expect(await storage.get('brand-new-key')).toBeNull()
  })
})
