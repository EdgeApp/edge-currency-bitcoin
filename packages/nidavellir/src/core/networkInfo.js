// @flow

import {
  type HDPathSetting,
  type NetworkInfo,
  type NetworkInfos,
  type NewNetworks
} from '../../types/core.js'
import { main } from '../networks/baseInfo.js'
import * as Networks from '../networks/networks.js'

export const getHDSetting = (network: string, value: any): HDPathSetting => {
  const { supportedHDPaths } = networks[network]
  for (const hdSetting of supportedHDPaths) {
    for (const key in hdSetting) {
      const setting = hdSetting[key]
      // checking if address that has legacy
      if (Array.isArray(setting)) {
        return setting.find(
          ({ prefix, stringPrefix }) =>
            prefix === value || stringPrefix === value
        )
      }

      // checking if xpub, xpriv, or address
      if (
        typeof setting === 'object' &&
        (setting.prefix === value || setting.stringPrefix === value)
      ) { return hdSetting }

      // if scriptType or purpose
      if (setting === value) return hdSetting
    }
  }
  throw new Error(`Wrong value: ${value} for network: ${network}`)
}

export const getDecoder = (network: string, value: any) => {
  const { supportedHDPaths } = networks[network]
  for (const hdSetting of supportedHDPaths) {
    for (const key in hdSetting) {
      const decoder = hdSetting[key]

      if (Array.isArray(decoder)) {
        return decoder.find(
          ({ prefix, stringPrefix }) =>
            prefix === value || stringPrefix === value
        )
      }

      if (decoder.prefix === value || decoder.stringPrefix === value) { return decoder.decoder }
    }
  }
  throw new Error(`Wrong value: ${value} for network: ${network}`)
}

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

export const getNetworkForVersion = (version: number): string => {
  for (const network in networks) {
    try {
      validateHDKeyVersion(version, network)
      return network
    } catch (e) {}
  }
  throw new Error('Unknown network version')
}

export const validateHDKeyVersion = (
  version: number,
  network: string = 'main'
) => {
  const setting = getHDSetting(network, version)
  if (!setting) throw new Error('Wrong key prefix for network')
  return version
}

export const getScriptType = (prefixNum: number, network: string = 'main') => {
  const setting = getHDSetting(network, prefixNum)
  if (!setting) {
    throw new Error(
      `Unknown address prefix ${prefixNum} for network ${network}`
    )
  }
  return setting.scriptType
}

export const getPrefixNum = (scriptType: string, network: string = 'main') => {
  const { supportedHDPaths } = networks[network]
  const hdSetting = supportedHDPaths.find(
    ({ scriptType: Script }) => scriptType === Script
  )
  if (!hdSetting) return 0
  const { address } = hdSetting
  return Array.isArray(address) ? address[0].prefix : address.prefix
}
