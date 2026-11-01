import type { EthereumProvider, TxData } from '@kohaku-eth/provider'
import type { ViemSignerAdapter } from '@kohaku-eth/provider/viem'
import { describe, expect, it } from 'vitest'
import { makeSendAndWait } from '../../src/chain/wallet.js'

const TX = { to: '0xabc', value: 1n } as unknown as TxData

describe('makeSendAndWait', () => {
  it('sends the tx, waits for the receipt, and returns hash + status', async () => {
    const provider = {
      waitForTransaction: async () => undefined,
      getTransactionReceipt: async () => ({ status: 1n }),
    } as unknown as EthereumProvider
    const signer = { sendTransaction: async () => '0xhash' } as unknown as ViemSignerAdapter

    const sendAndWait = makeSendAndWait(provider, signer)
    expect(await sendAndWait(TX)).toEqual({ hash: '0xhash', status: 1n })
  })

  it('propagates the reverted status rather than throwing itself', async () => {
    const provider = {
      waitForTransaction: async () => undefined,
      getTransactionReceipt: async () => ({ status: 0n }),
    } as unknown as EthereumProvider
    const signer = { sendTransaction: async () => '0xhash' } as unknown as ViemSignerAdapter

    const sendAndWait = makeSendAndWait(provider, signer)
    expect(await sendAndWait(TX)).toEqual({ hash: '0xhash', status: 0n })
  })

  it('throws if no receipt is found after waitForTransaction resolves', async () => {
    const provider = {
      waitForTransaction: async () => undefined,
      getTransactionReceipt: async () => null,
    } as unknown as EthereumProvider
    const signer = { sendTransaction: async () => '0xhash' } as unknown as ViemSignerAdapter

    const sendAndWait = makeSendAndWait(provider, signer)
    await expect(sendAndWait(TX)).rejects.toThrow(/No receipt found/)
  })
})
