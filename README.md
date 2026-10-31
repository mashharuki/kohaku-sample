# kohaku-sample

A Sepolia-only Node CLI sample of the [Kohaku SDK](https://ethereum.github.io/kohaku)
(`@kohaku-eth/plugins`), wiring up both the **Privacy Pools** and **Tornado Cash** protocol
plugins behind one `Host`: encrypted per-plugin storage, an allowlisted `network.fetch`, a
chunked-`getLogs` provider, and a public EOA wallet for shield/ragequit transactions. Every
write command is a **dry run by default** — nothing is sent until you pass `--execute` and then
type `yes` at the confirmation prompt.

**What these protocols actually do**, in plain terms: you *shield* (deposit) ETH into a shared
pool from your ordinary, public wallet — that deposit is visible on-chain. Later you *unshield*
(withdraw) to a different address, proving with a zero-knowledge proof that you made some
deposit into the pool without revealing which one; the recipient address is unlinkable to the
depositor address. A **paymaster** sponsors the withdrawal's gas so the recipient doesn't need
any ETH of its own (and doesn't need to send a transaction from a wallet that could link it back
to you); the **bundler** is the ERC-4337 relayer that actually submits that sponsored
transaction. Privacy Pools additionally requires each deposit to first be vetted by an
**ASP** (Association Set Provider) before it can be privately withdrawn — until then it's
*pending*, and the only way to get it back is **ragequit**: a *public* transaction straight back
to the original depositor (no privacy, used as an emergency exit). Tornado Cash has no such
vetting step but only accepts fixed deposit amounts (0.1/1/10/100 ETH, etc.).

This is a sample, not a wallet. The packages it wraps are alpha and unaudited; read
[`docs/pp-paymaster-mainnet-fork.md`](docs/pp-paymaster-mainnet-fork.md) and the error messages
in [`src/privacy-pools/errors.ts`](src/privacy-pools/errors.ts) /
[`src/tornado/errors.ts`](src/tornado/errors.ts) before relying on any of this beyond testing.
Tornado Cash's legal status varies by jurisdiction (it has been subject to sanctions in some);
check what applies where you are before using the `tc:*` commands, even on testnet.

## Setup

Requires Node >= 22.

```bash
pnpm install
cp .env.example .env
```

Fill in `.env`:

- `SEPOLIA_RPC_URL` — a Sepolia JSON-RPC endpoint (must report chain id `11155111`; anything
  else is refused before any plugin/storage/wallet code runs — see
  [`src/chain/guard.ts`](src/chain/guard.ts)).
- `MNEMONIC` — a **test wallet only** mnemonic. It's used both as the Kohaku keystore seed
  (scoped per-plugin, deriving notes) and, via the standard path `m/44'/60'/0'/0/0`, as the
  public signer that sends shield/ragequit transactions. Never use a mnemonic that holds real
  funds.
- `STORAGE_PASSWORD` — encrypts the local Kohaku storage files (AES-256-GCM, one file per
  plugin, under `.kohaku/`). Losing it only costs a resync, not funds — notes are re-derived
  from the mnemonic, not stored.

Get Sepolia test ETH from a faucet (e.g. [sepoliafaucet.com](https://sepoliafaucet.com)) for the
address `pnpm cli status` prints.

## Commands

```bash
pnpm cli status                                        # RPC/chain id, wallet address + balance, storage smoke test

pnpm cli tc:shield --amount 0.1 [--strategy minfee|maxanon] [--execute]
pnpm cli tc:notes [--include-spent]
pnpm cli tc:unshield --to <address> --amount 0.1 [--strict] [--call-gas-ceiling <gas>] [--execute]

pnpm cli pp:shield --amount 0.01 [--execute]
pnpm cli pp:balance
pnpm cli pp:ragequit [--execute]
```

Every command is read-only or a dry run until you add `--execute`. For example,
`pnpm cli pp:shield --amount 0.01` (no `--execute`) prints a plan and stops — nothing is signed
or sent (numbers below are illustrative, not real quotes):

```
from: 0xYourAddress...
deposit: 0.01 ETH
vetting fee: 0.0001 ETH (bps=100)
credited to note: 0.0099 ETH
minimum deposit: 0.005 ETH
(network gas for the deposit tx itself is on top of the above and is not shown here.)

(dry run — nothing was sent. Re-run with --execute to send it for real.)
```

Notes:

- `tc:shield` sums the deposit transactions' values against the requested amount and refuses to
  proceed if a remainder would be silently dropped (Tornado's fixed denominations don't divide
  every amount evenly) — pick an amount that's an exact sum of denominations (e.g. `0.1`, `0.11`,
  `1.1`).
- `tc:unshield` withdraws via the paymaster (the user's public account pays no gas). There is no
  fee-preview call for Tornado Cash — `prepareUnshield` itself is not a dry run (it proves and
  sends a signed operation to the bundler for estimation), so the real fee is only known after
  `--execute`. `--strict` requires a real gas estimate (`gasEstimationPolicy: 'required'`)
  instead of falling back silently. `--call-gas-ceiling` caps the sponsored `callGasLimit` —
  without it, an untrusted bundler could otherwise raise the fee up to whatever the withdrawn
  note affords.
- `pp:ragequit` is a **public** transaction back to the depositor address — it provides no
  privacy, and only pending (not yet ASP-approved) notes are eligible. There is no paymaster
  withdrawal command here: Privacy Pools' bundled paymaster config has no adapters configured on
  Sepolia (see `docs/pp-paymaster-mainnet-fork.md` for how to exercise that path on a mainnet
  fork instead).

## Development

```bash
pnpm typecheck
pnpm test          # unit: offline, mocked Host/plugins
pnpm test:e2e       # e2e: forks Sepolia with anvil (via prool); skipped unless ANVIL_FORK_RPC_URL is set
pnpm audit:kohaku   # static scan for common Kohaku integration pitfalls (scripts/kohaku_audit.py)
```

`test:e2e` needs an archive RPC to fork from (`ANVIL_FORK_RPC_URL` in `.env`) and the `anvil`
binary on `PATH` ([Foundry](https://getfoundry.sh/)); without it the suite reports as skipped
rather than failing.
