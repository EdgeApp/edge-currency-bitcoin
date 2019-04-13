// @flow

import {
  type NetworkInfo,
  type NetworkInfos,
  type NewNetworks
} from '../../types/core.js'
import { main } from '../networks/baseInfo.js'
import * as Networks from '../networks/networks.js'

export const getHDSetting = (network: string, value: any) => {
  const { supportedHDPaths } = networks[network]
  for (const hdSetting of supportedHDPaths) {
    for (const key in hdSetting) {
      let setting = hdSetting[key]

      if (Array.isArray(setting)) {
        setting = setting.find(({ prefix }) => prefix === value)
      } else {
        setting = setting.prefix
      }

      if (setting === value) return hdSetting
    }
  }
}

// export type Decoder = {
//   prefix: number | string,
//   decoder: BaseDecoder
// }

// export type HDPathSetting = {
//   scriptType: ScriptType,
//   purpose: number,
//   xpriv: Decoder,
//   xpub: Decoder,
//   address: Decoder | Array<Decoder>
// }

// export type ReplayProtection = {
//   forkSighash?: number,
//   forcedMinVersion?: number,
//   forkId?: number
// }

// export type NetworkInfo = {
//   coinType: number,
//   forks: Array<string>,
//   replayProtection: ReplayProtection,
//   wif: Decoder,
//   supportedHDPaths: Array<HDPathSetting>,
//   txHash: HashFunction<string>,
//   sigHash: HashFunction<Buffer>
// }

export const createInfo = (info: $Shape<NetworkInfo>): NetworkInfo => {
  const newNetwork: NetworkInfo = ({}: any)

  for (const set in main) {
    const mainSet = main[set]
    const infoSet = info[set]

    if (Array.isArray(mainSet)) {
      newNetwork[set] = (infoSet || [])
        .concat(mainSet)
        .filter((v, i, s) => s.indexOf(v) === i)
    } else if (typeof mainSet === 'object') {
      newNetwork[set] = { ...mainSet, ...(infoSet || {}) }
    } else if (typeof infoSet !== 'undefined') {
      newNetwork[set] = infoSet
    } else newNetwork[set] = mainSet
  }

  return newNetwork
}

export const createNetworks = (newInfos: NewNetworks) => {
  const networks = { main }
  for (const network in newInfos) {
    const infos = newInfos[network]
    for (const networkType in infos) {
      const partialInfo = infos[networkType]
      let name = network
      if (networkType !== 'main') name += networkType.toLowerCase()
      networks[name] = createInfo(partialInfo)
    }
  }
  return networks
}

export const networks: NetworkInfos = createNetworks(Networks)

export const addNetworks = (newInfos: NewNetworks) =>
  Object.assign(networks, createNetworks(newInfos))

export const getExtendedKeyVersion = (
  hdKey: { privateKey?: any, publicKey?: any },
  network: string = 'main'
): number => {
  const { supportedHDPaths } = networks[network]
  // $FlowFixMe - kylanfixes
  if (hdKey.privateKey) return HDKeyConfig.prefixes.xprivkey[0]
  // $FlowFixMe - kylanfixes
  if (hdKey.publicKey) return HDKeyConfig.prefixes.xpubkey[0]
  throw new Error("Can't get version without a key")
}

export const getNetworkForVersion = (version: number): string => {
  for (const network in networks) {
    try {
      validateHDKeyVersion(version, network)
      return network
    } catch (e) {}
  }
  throw new Error('Unknown network version')
}

export const validateHDKeyVersion = (version: number, network: string = 'main') => {
  const setting = getHDSetting(network, version)
  if (!setting) throw new Error('Wrong key prefix for network')
  return version
}

export const getScriptType = (prefixNum: number, network: string = 'main') => {
  const setting = getHDSetting(network, prefixNum)
  if (!setting) throw new Error(`Unknown address prefix ${prefixNum} for network ${network}`)
  return setting.scriptType
}

export const getPrefixNum = (scriptType: string, network: string = 'main') => {
  const { supportedHDPaths } = networks[network]
  const hdSetting = supportedHDPaths.find(({ scriptType: Script }) => scriptType === Script)
  if (!hdSetting) return 0
  const { address } = hdSetting
  return Array.isArray(address) ? address[0].prefix : address.prefix
}
