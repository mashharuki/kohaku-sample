import { formatEther, parseEther } from 'viem'

export function formatWei(wei: bigint): string {
  return `${formatEther(wei)} ETH`
}

export function parseEthAmount(input: string): bigint {
  return parseEther(input)
}

/** Kohaku's PP history reports transactionHash as a bigint (0n for entries sourced from a root/state snapshot). */
export function txHashToHex(hash: bigint): string {
  return hash === 0n ? '(unknown — synced from a state snapshot, not a live log)' : `0x${hash.toString(16).padStart(64, '0')}`
}

export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}
