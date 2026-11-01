import { createServer } from 'prool'
import { anvil } from 'prool/instances'

export type AnvilFork = {
  rpcUrl: string
  stop: () => Promise<void>
}

/** A few blocks behind the current head, to dodge momentarily-inconsistent heads across a
 *  load-balanced public RPC's backend nodes (forking exactly "latest" can otherwise 400 with
 *  "block not found" if the node that serves the fork lags the node that reported the head). */
const HEAD_SAFETY_MARGIN = 10n

async function fetchLatestBlockNumber(rpcUrl: string): Promise<bigint> {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
  })
  const { result } = (await res.json()) as { result: string }
  return BigInt(result)
}

/**
 * Boots one anvil instance (via prool) forking from `forkUrl`, and waits for it to actually be
 * up before returning. prool's pool lazily spawns the anvil process on first request, which
 * races the test's own first request (observed ~1-in-3 as a bare 400 from the proxy); hitting
 * the pool's own `/<id>/start` endpoint first and awaiting its response avoids that race.
 */
export async function startAnvilFork(opts: {
  forkUrl: string
  forkBlockNumber?: bigint
  chainId?: number
}): Promise<AnvilFork> {
  const forkBlockNumber =
    opts.forkBlockNumber ?? (await fetchLatestBlockNumber(opts.forkUrl)) - HEAD_SAFETY_MARGIN

  const server = createServer({
    port: 0,
    instance: anvil({ forkUrl: opts.forkUrl, forkBlockNumber, chainId: opts.chainId }),
  })
  await server.start()
  const address = server.address()
  if (!address) throw new Error('anvil server did not report a listen address')
  const base = `http://127.0.0.1:${address.port}`

  const maxAttempts = 3
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(`${base}/1/start`)
    if (res.ok) break
    if (attempt === maxAttempts)
      throw new Error(
        `anvil fork failed to start after ${maxAttempts} attempts: ${await res.text()}`,
      )
  }

  return {
    rpcUrl: `${base}/1`,
    stop: () => server.stop(),
  }
}
