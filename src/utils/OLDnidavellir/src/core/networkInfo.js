// @flow
import { type BaseDecoder } from '../../types/utils.js'
import {
  type HDPathSetting,
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
// /////////////////
// /////////////////
// /////////////////
// /////////////////
// /////////////////
// /////////////////
// /////////////////
// /////////////////
// /////////////////
// /////////////////
// /////////////////
// /////////////////
// /////////////////
// /////////////////
export const getHDSetting = (value: any, network?: string): HDPathSetting => {
  // If no network is specified, check all available networks
  if (!network) {
    for (const network in networks) {
      try {
        return getHDSetting(value, network)
      } catch (e) {}
    }
    throw new Error('Unknown prefix')
  }

  const { HDPaths } = networks[network]
  for (const purpose in HDPaths) {
    const hdPath = HDPaths[purpose]
    for (const key in hdPath) {
      const setting = hdPath[key]
      // checking if address that has legacy
      if (Array.isArray(setting)) {
        return setting.find(
          ({ prefixHex, prefixStr }) =>
            prefixHex === value || prefixStr === value
        )
      }

      // checking if xpub, xpriv, or address
      if (
        typeof setting === 'object' &&
        (setting.prefixHex === value || setting.prefixStr === value)
      ) {
        return hdPath
      }

      // if scriptType or purpose
      if (setting === value) return hdPath
    }
  }
  throw new Error(`Wrong value: ${value} for network: ${network}`)
}

export const getDecoder = (network: string, value: any): BaseDecoder => {
  const hdPath = getHDSetting(value, network)
  for (const key in hdPath) {
    const decoder = hdPath[key]

    if (Array.isArray(decoder)) {
      return decoder.find(
        ({ prefixHex, prefixStr }) =>
          prefixHex === value || prefixStr === value
      )
    }

    if (decoder.prefixHex === value || decoder.prefixStr === value) {
      return decoder.decoder
    }
  }
  throw new Error(`Wrong value: ${value} for network: ${network}`)
}
