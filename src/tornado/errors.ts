import { InsufficientBalanceError, KeystorePathNotAllowedError } from '@kohaku-eth/plugins'
import { TornadoArtifactsIntegrityError } from '@kohaku-eth/tornado-cash'

/**
 * Maps SDK errors to user-facing messages. In @kohaku-eth/tornado-cash alpha.32, insufficient
 * note balance throws a plain `Error` from inside the worker (not InsufficientBalanceError —
 * class identity may not even survive the worker boundary), so we match both the class and
 * the message text.
 */
export function toTornadoUserError(e: unknown): Error {
  if (
    e instanceof InsufficientBalanceError ||
    (e instanceof Error && /Insufficient balance/i.test(e.message))
  ) {
    return new Error(
      'No single note (or combination) covers this amount at this denomination. Check `tc:notes` for what is available.',
    )
  }
  if (e instanceof TornadoArtifactsIntegrityError) {
    return new Error(
      'Proving artifacts failed their integrity check — refusing to proceed. Delete the local artifact cache and retry.',
    )
  }
  if (e instanceof KeystorePathNotAllowedError) {
    return new Error('Keystore refused a derivation path required by the Tornado Cash plugin.')
  }
  if (e instanceof Error) return e
  return new Error(describeNonError(e))
}

/**
 * Some SDK errors lose their Error prototype crossing a worker/WASM boundary and arrive here
 * as a plain object — `String(e)` on those gives the useless "[object Object]". Prefer a
 * `.message` field if present, otherwise fall back to a JSON dump so the cause is visible.
 */
function describeNonError(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e)
    return String((e as { message: unknown }).message)
  if (e && typeof e === 'object') {
    try {
      return JSON.stringify(e)
    } catch {
      // fall through
    }
  }
  return String(e)
}
