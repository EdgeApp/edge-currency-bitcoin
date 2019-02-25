// @flow

import type {
  NetworkInfo,
  NetworkInfos,
  NewNetworks,
  PartialInfo
} from '../../types/core.js'
import { main } from '../networks/baseInfo.js'
import * as Networks from '../networks/networks.js'

export const createInfo = (info: PartialInfo): NetworkInfo => {
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
) => {
  const { keyPrefix = {} } = networks[network]
  if (hdKey.privateKey) return keyPrefix.xprivkey
  if (hdKey.publicKey) return keyPrefix.xpubkey
  throw new Error("Can't get version without a key")
}

export const getNetworkForVersion = (version: number): string => {
  for (const network in networks) {
    try {
      checkVersion(version, network)
      return network
    } catch (e) {}
  }
  throw new Error('Unknown network version')
}

export const checkVersion = (version: number, network: string = 'main') => {
  const { keyPrefix = {} } = networks[network]
  if (version) {
    for (const prefix in keyPrefix) {
      if (keyPrefix[prefix] === version) return version
    }
    throw new Error('Wrong key prefix for network')
  }
}

export const getPrefixType = (prefixNum: number, network: string = 'main') => {
  const getPrefix = addressPrefix => {
    for (const prefixType in addressPrefix) {
      if (addressPrefix[prefixType] === prefixNum) {
        return prefixType
      }
    }
    return null
  }
  const { addressPrefix, legacyAddressPrefix } = networks[network]
  const type = getPrefix(addressPrefix) || getPrefix(legacyAddressPrefix)

  if (!type) {
    throw new Error(`Unknown prefix ${prefixNum} for network ${network}`)
  }
  return type
}

export const getPrefixNum = (type: string, network: string = 'main') => {
  const { addressPrefix, legacyAddressPrefix } = networks[network]
  const cashAddress = addressPrefix.cashAddress
  return !cashAddress ? addressPrefix[type] : legacyAddressPrefix[type]
}
