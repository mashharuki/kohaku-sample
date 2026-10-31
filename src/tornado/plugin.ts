import type { Host } from '@kohaku-eth/plugins'
import { TornadoCashConfigs, createTCPlugin } from '@kohaku-eth/tornado-cash'
import type { TornadoArtifacts } from './artifacts.js'

export function createTornado(host: Host, chainId: 11155111, artifactsLoader: () => Promise<TornadoArtifacts>) {
  return createTCPlugin(host, {
    accountIndex: 0,
    protocolConfig: TornadoCashConfigs[chainId],
    artifactsLoader,
  })
}

export type Tornado = ReturnType<typeof createTornado>
