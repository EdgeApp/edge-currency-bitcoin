// @flow

import {
  type NetworkInfo,
  type NetworkInfos,
  type NewNetworks
} from '../../types/core.js'
import { main } from '../networks/baseInfo.js'
import * as Networks from '../networks/networks.js'

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
  const { HDKeyConfig } = networks[network]
  // $FlowFixMe - kylanfixes
  if (hdKey.privateKey) return HDKeyConfig.prefixes.xprivkey[0]
  // $FlowFixMe - kylanfixes
  if (hdKey.publicKey) return HDKeyConfig.prefixes.xpubkey[0]
  throw new Error("Can't get version without a key")
}

export const getNetworkForVersion = (version: number): string => {
  for (const network in networks) {
    try {
      validateHDKeyPrefix(version, network)
      return network
    } catch (e) {}
  }
  throw new Error('Unknown network version')
}

export const validateHDKeyPrefix = (keyPrefix: number, network: string = 'main') => {
  const { HDKeyConfig } = networks[network]
  if (HDKeyConfig.prefixes) {
    // $FlowFixMe - kylanfixes
    const { xprivkey, xpubkey } = HDKeyConfig.prefixes
    // $FlowFixMe - kylanfixes
    if (xprivkey[0] === keyPrefix || xpubkey[0] === keyPrefix) return keyPrefix
    throw new Error('Wrong key prefix for network')
  }
}

export const getPrefixType = (prefixNum: number, network: string = 'main') => {
  const getPrefix = addressPrefixes => {
    // $FlowFixMe - kylanfixes
    for (const prefixType in addressPrefixes) {
    // $FlowFixMe - kylanfixes
      for (const prefixVersion of addressPrefixes[prefixType]) {
        if (prefixVersion === prefixNum) {
          return prefixType
        }
      }
    }
    return null
  }
  const { addressConfig } = networks[network]
  const type = getPrefix(addressConfig.prefixes)

  if (!type) {
    throw new Error(`Unknown prefix ${prefixNum} for network ${network}`)
  }
  return type
}

export const getPrefixNum = (scriptType: string, network: string = 'main') => {
  const { addressConfig } = networks[network]
  // $FlowFixMe - kylanfixes
  const scriptTypePrefix = addressConfig.prefixes[scriptType]
  if (!scriptTypePrefix) return 0
  // $FlowFixMe - kylanfixes
  return scriptTypePrefix[0]
}
