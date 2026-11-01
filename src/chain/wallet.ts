import type { EthereumProvider, TxData } from '@kohaku-eth/provider'
import { ViemSignerAdapter } from '@kohaku-eth/provider/viem'
import { type Chain, createWalletClient, type Hex, http } from 'viem'
import { mnemonicToAccount } from 'viem/accounts'

/**
 * The "public" signer used for shield deposits and PP ragequit — ordinary, visible-on-chain
 * transactions from the user's own EOA. This is intentionally separate from Host.keystore
 * (which Kohaku plugins use internally, scoped to their own derivation prefixes): see
 * host-and-provider.md's isolation boundary. Standard BIP-44 path m/44'/60'/0'/0/0 (viem's
 * default addressIndex 0).
 */
export function makePublicWallet(mnemonic: string, chain: Chain, rpcUrl: string) {
  const account = mnemonicToAccount(mnemonic)
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) })
  const signer = new ViemSignerAdapter(walletClient)
  return { address: account.address as Hex, signer }
}

export type SendAndWait = (tx: TxData) => Promise<{ hash: Hex; status: bigint }>

/** Sends one tx and waits for its receipt, returning the receipt status (1n = success). */
export function makeSendAndWait(
  provider: EthereumProvider,
  signer: ViemSignerAdapter,
): SendAndWait {
  return async (tx: TxData) => {
    const hash = (await signer.sendTransaction(tx)) as Hex
    await provider.waitForTransaction(hash)
    const receipt = await provider.getTransactionReceipt(hash)
    if (!receipt)
      throw new Error(`No receipt found for tx ${hash} after waitForTransaction resolved`)
    return { hash, status: receipt.status }
  }
}
