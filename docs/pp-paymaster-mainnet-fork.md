# Testing PP paymaster withdrawals on a mainnet fork

`pp:ragequit` and `pp:balance` work fine against Sepolia. `pp:unshield` (sponsored, paymaster-mode
withdrawal) does not exist in this sample's CLI, and if it did, `prepareUnshield(..., { mode:
'paymaster' })` would throw `No paymaster adapter configured for pool` on Sepolia — see
[`src/privacy-pools/errors.ts`](../src/privacy-pools/errors.ts). This is not a bug in this sample;
0xBow's bundled Privacy Pools paymaster config only has real entries for mainnet
(`PrivacyPoolsV1_0xBow[11155111]`'s paymaster address is `0x0`, and `poolsAccountsMap` is empty).
Sepolia has no deployed paymaster/adapter to sponsor the withdrawal's gas.

The only way to exercise the paymaster path at all is a **mainnet fork**. This sample is
Sepolia-only by design (see [`src/chain/guard.ts`](../src/chain/guard.ts)), so this is a one-off
test setup, not something the CLI itself should grow a flag for.

## What you need

- A mainnet archive RPC URL to fork from (anvil replays history from one block; a non-archive
  node will fail once the fork needs state older than its retention window).
- `anvil` on `PATH` (installed with [Foundry](https://getfoundry.sh/)).
- A test wallet with **approved** (not pending) Privacy Pools balance on mainnet at the account
  index you're testing — paymaster withdrawals only spend approved value
  (`InsufficientBalanceError` otherwise). On a fork you'd normally get this by impersonating a
  real depositor account rather than minting fresh approved notes, since approval requires a real
  ASP root update (see below).

## Steps

1. **Fork mainnet.** Reuse [`test/e2e/utils/anvil.ts`](../test/e2e/utils/anvil.ts)'s
   `startAnvilFork({ forkUrl, chainId: 1 })`, or run anvil directly:
   ```bash
   anvil --fork-url <mainnet-archive-rpc> --chain-id 1
   ```
2. **Build a Host against the fork, bypassing this sample's Sepolia guard.** Don't call
   `makeNodeProvider` ([`src/host/createHost.ts`](../src/host/createHost.ts)) — it calls
   `assertSepoliaChainId` and will `process.exit(1)` on a mainnet fork. Build the provider
   directly instead:
   ```ts
   import { createPublicClient, http } from 'viem'
   import { mainnet } from 'viem/chains'
   import { viem } from '@kohaku-eth/provider/viem'
   import { withChunkedGetLogs } from '../src/host/chunkedProvider.js'

   const provider = withChunkedGetLogs(viem(createPublicClient({ chain: mainnet, transport: http(forkRpcUrl) })))
   ```
   Then `makeHost({ provider, chain: mainnet, mnemonic, storagePath, password })` as usual —
   `buildAllowedHosts(1)` resolves the mainnet bundler host automatically.
3. **Use the mainnet deployment.** `PrivacyPoolsV1_0xBow[1]` (entrypoint
   `0x6818809EefCe719E480a7526D76bD3e561526b46`, deployment block `22153713n`) instead of the
   Sepolia entry `createPools` ([`src/privacy-pools/plugin.ts`](../src/privacy-pools/plugin.ts))
   uses today.
4. **Get an approved balance on the fork.** Either:
   - Impersonate a real mainnet depositor address that already has approved notes
     (`anvil_impersonateAccount`), and drive the plugin with that account's mnemonic/keystore
     (requires knowing or controlling that account's keys — usually not possible for a real
     depositor, so this only works for a test wallet you've deposited with yourself on a
     previous mainnet-fork run with the same `initialState`/snapshot block); or
   - Deposit fresh on the fork (`pp:shield`-equivalent `prepareShield`/`estimateShield`), then
     get it **approved**: impersonate the Entrypoint's ASP postman address
     (`anvil_impersonateAccount`) and call `entrypoint.updateRoot(root, ipfsCID)` with a root that
     includes your deposit's label. Computing that root needs the same Poseidon LeanIMT the ASP
     uses (`@kohaku-eth/poseidon-lean-imt`'s `PoseidonT3LeanIMT`, already a devDependency here).
     See the kohaku-sdk-builder skill's `references/testing.md` §4 for the exact helper shape
     (`pushNewAspRoot` / `setupMockAspForTest`) and the upstream privacy-pools repo's
     `tests/utils/mock-asp-service.ts` / `tests/utils/test-helpers.ts` for a working
     implementation to adapt.
5. **Call `prepareUnshield` with `mode: 'paymaster'`.** A real bundler can't see your anvil fork,
   so either run a local bundler (Alto/Skandha) against the fork and point
   `paymasterConfig[1].bundlerUrl` at it, or mock the bundler's JSON-RPC
   (`eth_estimateUserOperationGas`, `eth_sendUserOperation`, `eth_getUserOperationReceipt`) inside
   `host.network.fetch` and assert the userOp shape instead of actually broadcasting.

## What to assert

- `op.mode === 'paymaster'`; the recipient address appears in the right place in calldata.
- `fee` (from `estimateUnshield`) stays under whatever ceiling your UI would show the user.
- `maxGasLimits` violations throw rather than silently inflating the fee.
- `gasEstimation.status` is handled for both `'ok'` and `'fallback'` (see
  [`src/tornado/unshield.ts`](../src/tornado/unshield.ts) for the equivalent Tornado-side handling
  this sample already does; Privacy Pools paymaster withdrawals should get the same treatment if
  this sample ever adds them).

This is deliberately out of scope for this sample's own test suite
([`test/e2e/sepoliaFork.e2e.test.ts`](../test/e2e/sepoliaFork.e2e.test.ts) only forks Sepolia) —
it needs a mainnet archive RPC, real on-chain state to impersonate or approve, and a bundler, none
of which this sample depends on for its actual (Sepolia, ragequit-only) feature set.
