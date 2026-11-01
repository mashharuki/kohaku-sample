# kohaku-sample

[Kohaku SDK](https://ethereum.github.io/kohaku)(`@kohaku-eth/plugins`)を使った、Sepolia専用のNode CLIサンプルです。**Privacy Pools**と**Tornado Cash**の両プロトコルプラグインを1つの`Host`にまとめて配線しています:プラグインごとに暗号化されたストレージ、許可リスト方式の`network.fetch`、チャンク分割された`getLogs`プロバイダ、そしてshield/ragequitトランザクション用の公開EOAウォレットです。書き込み系コマンドはすべて**デフォルトでドライラン**です——`--execute`を渡し、確認プロンプトで`yes`と入力するまで何も送信されません。

**これらのプロトコルが実際に何をしているか**を平易に説明すると:あなたは通常の公開ウォレットから共有プール内に*shield*(デポジット)としてETHを預け入れます——このデポジットはオンチェーンで見えます。その後、別のアドレスに*unshield*(ウィズドロー)する際、ゼロ知識証明によって「プールに何らかのデポジットをした」ことを証明しますが、「どのデポジットか」は明らかにしません。これにより受取アドレスとデポジットしたアドレスとの紐付けができなくなります。**paymaster**がウィズドローのガス代をスポンサーするため、受取人は自身のETHを用意する必要がなく(かつ、自分とリンクされかねないウォレットからトランザクションを送信する必要もありません)。**bundler**はこのスポンサー付きトランザクションを実際に送信するERC-4337リレーヤーです。Privacy Poolsではさらに、各デポジットがプライベートにウィズドローされる前に**ASP**(Association Set Provider)による審査を受ける必要があります——審査が済むまでは*pending*(保留中)状態で、その資金を取り戻す唯一の手段が**ragequit**です:これは元のデポジット者へ直接戻す*公開*トランザクションであり(プライバシーはなく、緊急時の退避手段として使うものです)。一方、Tornado Cashにはこの審査プロセスはありませんが、固定の預入額(0.1/1/10/100 ETHなど)しか受け付けません。

これはサンプルであり、ウォレットではありません。ここでラップしているパッケージはアルファ版かつ未監査です。テスト目的を超えて利用する前に、[`docs/pp-paymaster-mainnet-fork.md`](docs/pp-paymaster-mainnet-fork.ja.md)と[`src/privacy-pools/errors.ts`](src/privacy-pools/errors.ts) / [`src/tornado/errors.ts`](src/tornado/errors.ts)のエラーメッセージを必ず読んでください。Tornado Cashの法的な扱いは法域によって異なります(一部では制裁対象になった経緯があります)。テストネット上であっても、`tc:*`系コマンドを使う前に自分の所在地で適用される規制を確認してください。

## セットアップ

Node >= 22が必要です。

```bash
pnpm install
cp .env.example .env
```

`.env`に以下を設定します:

- `SEPOLIA_RPC_URL` — Sepoliaのjson-RPCエンドポイント(chain idが`11155111`である必要があります。そうでない場合、プラグイン/ストレージ/ウォレット関連のコードが動く前に拒否されます——[`src/chain/guard.ts`](src/chain/guard.ts)参照)。
- `MNEMONIC` — **テスト用ウォレット専用**のニーモニックです。Kohakuのキーストアシード(プラグインごとにスコープされ、ノートを導出)として使われると同時に、標準パス`m/44'/60'/0'/0/0`経由でshield/ragequitトランザクションを送信する公開署名者としても使われます。実際の資金を保有するニーモニックは絶対に使わないでください。
- `STORAGE_PASSWORD` — ローカルのKohakuストレージファイル(`.kohaku/`配下、プラグインごとに1ファイル、AES-256-GCM)を暗号化します。これを失っても再同期で済み、資金を失うことはありません——ノートはニーモニックから再導出されるものであり、保存されているわけではありません。

`pnpm cli status`が出力するアドレスに対して、フォーセット(例: [sepoliafaucet.com](https://sepoliafaucet.com))からSepoliaのテストETHを取得してください。

## コマンド

```bash
pnpm cli status                                        # RPC/chain id、ウォレットアドレス+残高、ストレージの動作確認

pnpm cli tc:shield --amount 0.1 [--strategy minfee|maxanon] [--execute]
pnpm cli tc:notes [--include-spent]
pnpm cli tc:unshield --to <address> --amount 0.1 [--strict] [--call-gas-ceiling <gas>] [--execute]

pnpm cli pp:shield --amount 0.01 [--execute]
pnpm cli pp:balance
pnpm cli pp:ragequit [--execute]
```

すべてのコマンドは`--execute`を追加するまで読み取り専用、またはドライランです。例えば`pnpm cli pp:shield --amount 0.01`(`--execute`なし)はプランを出力して停止します——何も署名・送信されません(以下の数値は例示用で、実際のクォートではありません):

```
from: 0xYourAddress...
deposit: 0.01 ETH
vetting fee: 0.0001 ETH (bps=100)
credited to note: 0.0099 ETH
minimum deposit: 0.005 ETH
(network gas for the deposit tx itself is on top of the above and is not shown here.)

(dry run — nothing was sent. Re-run with --execute to send it for real.)
```

補足:

- `tc:shield`はデポジットトランザクションの合計値を要求額と照合し、余りが暗黙に捨てられてしまう場合は処理を拒否します(Tornadoの固定denominationはすべての金額をきれいに割り切れるわけではないため)——denominationの正確な合計になる金額(例: `0.1`、`0.11`、`1.1`)を選んでください。
- `tc:unshield`はpaymaster経由でウィズドローします(ユーザーの公開アカウントはガス代を支払いません)。Tornado Cashにはフィーのプレビュー呼び出しがありません——`prepareUnshield`自体がドライランではなく(証明を生成し、推定のため署名済みオペレーションをbundlerへ送信します)、実際のフィーは`--execute`後にのみ分かります。`--strict`を指定すると、暗黙のフォールバックではなく実際のガス見積もり(`gasEstimationPolicy: 'required'`)が必須になります。`--call-gas-ceiling`はスポンサーされる`callGasLimit`の上限を設定します——指定しない場合、信頼できないbundlerがウィズドローするノートの余力いっぱいまでフィーを引き上げる可能性があります。
- `pp:ragequit`はデポジット者のアドレスへ戻す**公開**トランザクションです——プライバシーは提供されず、対象となるのは(ASPに承認済みではない)pendingなノートのみです。ここにはpaymaster経由のウィズドローコマンドはありません:Privacy Poolsにバンドルされたpaymaster設定にはSepolia向けのアダプタが一切設定されていないためです(mainnetフォーク上でこのパスを試す方法は`docs/pp-paymaster-mainnet-fork.ja.md`を参照してください)。

## 開発

```bash
pnpm typecheck
pnpm test          # unit: オフライン、Host/プラグインはモック化
pnpm test:e2e       # e2e: anvil(prool経由)でSepoliaをフォーク。ANVIL_FORK_RPC_URLが設定されていない場合はスキップ
pnpm audit:kohaku   # Kohaku統合でよくある落とし穴を静的にスキャン(scripts/kohaku_audit.py)
```

`test:e2e`にはフォーク元となるアーカイブRPC(`.env`の`ANVIL_FORK_RPC_URL`)と、`PATH`上の`anvil`バイナリ([Foundry](https://getfoundry.sh/))が必要です。これらがない場合、テストスイートは失敗ではなくスキップとして報告されます。
