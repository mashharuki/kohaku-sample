import {
  InsufficientBalanceError,
  KeystorePathNotAllowedError,
  PluginError,
} from '@kohaku-eth/plugins'
import { PPv1ExactOutputError } from '@kohaku-eth/privacy-pools'

export function toPpUserError(e: unknown): Error {
  if (e instanceof InsufficientBalanceError) {
    return new Error(
      `Not enough approved balance (have ${e.available}, need ${e.required}). Pending deposits can't be withdrawn/ragequit-approved until the ASP approves them.`,
    )
  }
  if (e instanceof PPv1ExactOutputError) {
    return new Error('Fee too high for the requested exact output; lower the amount.')
  }
  if (e instanceof KeystorePathNotAllowedError) {
    return new Error('Keystore refused a derivation path required by the Privacy Pools plugin.')
  }
  if (e instanceof Error && /No paymaster adapter configured/i.test(e.message)) {
    return new Error(
      'Sponsored (paymaster) withdrawals are not available for Privacy Pools on Sepolia — the bundled config is a placeholder here. Use ragequit instead, or see docs/pp-paymaster-mainnet-fork.md.',
    )
  }
  if (e instanceof PluginError) return e
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
