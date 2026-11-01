# mainnetフォーク上でPPのpaymasterウィズドローをテストする

`pp:ragequit`と`pp:balance`はSepolia上で問題なく動作します。`pp:unshield`(paymaster経由のスポンサー付きウィズドロー)は、このサンプルのCLIには存在しません。もし存在していたとしても、Sepolia上で`prepareUnshield(..., { mode: 'paymaster' })`を呼ぶと`No paymaster adapter configured for pool`がスローされます——[`src/privacy-pools/errors.ts`](../src/privacy-pools/errors.ts)を参照してください。これはこのサンプルのバグではありません。0xBowがバンドルしているPrivacy Poolsのpaymaster設定には、mainnet向けのエントリしか実体がないためです(`PrivacyPoolsV1_0xBow[11155111]`のpaymasterアドレスは`0x0`で、`poolsAccountsMap`も空です)。Sepoliaにはウィズドローのガス代をスポンサーするpaymaster/アダプタがデプロイされていません。

paymasterのパスを少しでも検証する唯一の方法は**mainnetフォーク**です。このサンプルは設計上Sepolia専用なので([`src/chain/guard.ts`](../src/chain/guard.ts)参照)、これはCLI自体にフラグを追加して対応するようなものではなく、一度限りのテストセットアップとして行うものです。

## 必要なもの

- フォーク元となるmainnetのアーカイブRPC URL(anvilは1つのブロックから履歴をリプレイするため、非アーカイブノードではフォークが保持期間より古いstateを必要とした時点で失敗します)。
- `PATH`上の`anvil`([Foundry](https://getfoundry.sh/)でインストール)。
- テスト対象のアカウントインデックスで、mainnet上に**承認済み**(pendingではない)のPrivacy Poolsバランスを持つテストウォレット——paymasterウィズドローは承認済みの価値しか消費できません(そうでなければ`InsufficientBalanceError`になります)。フォーク上では通常、新規に承認済みノートを発行するのではなく、実在するデポジット者のアカウントをimpersonateして得ます。承認には実際のASPルート更新が必要だからです(詳細は後述)。

## 手順

1. **mainnetをフォークする。** [`test/e2e/utils/anvil.ts`](../test/e2e/utils/anvil.ts)の`startAnvilFork({ forkUrl, chainId: 1 })`を再利用するか、anvilを直接実行します:
   ```bash
   anvil --fork-url <mainnet-archive-rpc> --chain-id 1
   ```
2. **フォーク向けにHostを構築し、このサンプルのSepoliaガードを回避する。** `makeNodeProvider`([`src/host/createHost.ts`](../src/host/createHost.ts))は呼ばないでください——これは`assertSepoliaChainId`を呼び出し、mainnetフォーク上では`process.exit(1)`してしまいます。代わりにプロバイダを直接構築します:
   ```ts
   import { createPublicClient, http } from 'viem'
   import { mainnet } from 'viem/chains'
   import { viem } from '@kohaku-eth/provider/viem'
   import { withChunkedGetLogs } from '../src/host/chunkedProvider.js'

   const provider = withChunkedGetLogs(viem(createPublicClient({ chain: mainnet, transport: http(forkRpcUrl) })))
   ```
   その後はいつもどおり`makeHost({ provider, chain: mainnet, mnemonic, storagePath, password })`を呼び出します——`buildAllowedHosts(1)`がmainnetのbundlerホストを自動的に解決します。
3. **mainnetのデプロイメントを使う。** 現在Sepoliaのエントリ(`createPools`、[`src/privacy-pools/plugin.ts`](../src/privacy-pools/plugin.ts))が使っているものの代わりに、`PrivacyPoolsV1_0xBow[1]`(エントリーポイント`0x6818809EefCe719E480a7526D76bD3e561526b46`、デプロイブロック`22153713n`)を使います。
4. **フォーク上で承認済みバランスを得る。** いずれかの方法で行います:
   - 既に承認済みノートを持つ実在のmainnetデポジット者アドレスをimpersonateし(`anvil_impersonateAccount`)、そのアカウントのニーモニック/キーストアでプラグインを操作する(そのアカウントの鍵を知っている、あるいは制御できる必要があり、実在のデポジット者に対しては通常不可能です。そのため、同じ`initialState`/スナップショットブロックを使った過去のmainnetフォーク実行で自分自身がデポジットしたテストウォレットに対してのみ有効です)。または
   - フォーク上で新規にデポジットし(`pp:shield`相当の`prepareShield`/`estimateShield`)、それを**承認**させる:EntrypointのASP postmanアドレスをimpersonateし(`anvil_impersonateAccount`)、自分のデポジットのラベルを含むrootを使って`entrypoint.updateRoot(root, ipfsCID)`を呼び出す。このrootの計算には、ASPが使っているのと同じPoseidon LeanIMT(`@kohaku-eth/poseidon-lean-imt`の`PoseidonT3LeanIMT`。これは本リポジトリに既にdevDependencyとして入っています)が必要です。正確なヘルパーの形(`pushNewAspRoot` / `setupMockAspForTest`)はkohaku-sdk-builderスキルの`references/testing.md` §4を、動作する実装例は本家privacy-poolsリポジトリの`tests/utils/mock-asp-service.ts` / `tests/utils/test-helpers.ts`を参照してください。
5. **`mode: 'paymaster'`で`prepareUnshield`を呼ぶ。** 実際のbundlerはあなたのanvilフォークを見ることができないため、フォークに対してローカルのbundler(Alto/Skandha)を動かして`paymasterConfig[1].bundlerUrl`をそこに向けるか、`host.network.fetch`内でbundlerのJSON-RPC(`eth_estimateUserOperationGas`、`eth_sendUserOperation`、`eth_getUserOperationReceipt`)をモックし、実際にブロードキャストする代わりにuserOpの形をアサートしてください。

## 何を確認すべきか

- `op.mode === 'paymaster'`であること。受取アドレスがcalldata内の正しい位置に現れること。
- (`estimateUnshield`から得られる)`fee`が、UIがユーザーに表示するであろう上限を下回っていること。
- `maxGasLimits`違反が、フィーを静かに膨張させるのではなく、例外をスローすること。
- `gasEstimation.status`が`'ok'`と`'fallback'`の両方で適切に処理されること([`src/tornado/unshield.ts`](../src/tornado/unshield.ts)にある、このサンプルが既に行っているTornado側の同等な処理を参照してください。Privacy Poolsのpaymasterウィズドローをこのサンプルに追加する場合も、同じ扱いをすべきです)。

これは、このサンプル自身のテストスイート([`test/e2e/sepoliaFork.e2e.test.ts`](../test/e2e/sepoliaFork.e2e.test.ts)はSepoliaのみをフォークします)の対象範囲からは意図的に外しています——mainnetのアーカイブRPC、impersonateまたは承認が必要な実際のオンチェーンstate、そしてbundlerが必要であり、これらはこのサンプルの実際の機能セット(Sepolia限定、ragequitのみ)にはいずれも依存していないためです。
