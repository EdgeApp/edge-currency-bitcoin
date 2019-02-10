// @flow

import { main, testnet } from '@perian/network-info'
import type { NetworkInfos } from '@perian/network-info'

import type { HDPath, HDStandardPathParams } from '../../types/hd.js'
import type { FullNetworkInfos } from '../../types/network.js'
import { fromBips, fromSettings } from '../bip44/paths.js'

export const networks: FullNetworkInfos = {
  main: { ...main, hdSettings: fromBips(main.supportedBips) },
  testnet: { ...testnet, hdSettings: fromBips(testnet.supportedBips) }
}

export const addNetworks = (networks: { [network: string]: NetworkInfos }) => {
  for (const network in networks) {
    addNetwork(network, networks[network])
  }
}

export const addNetwork = (network: string, infos: NetworkInfos = {}) => {
  for (const netType in infos) {
    const newInfo = infos[netType]
    const baseInfo = networks[netType]
    const mergedInfo = {}
    for (const setting in baseInfo) {
      const baseSetting = baseInfo[setting]
      if (Array.isArray(baseSetting)) {
        const newSetting = newInfo[setting] || []
        const oldSetting = baseSetting.filter(
          item => newSetting.indexOf(item) === -1
        )
        mergedInfo[setting] = [...newSetting, ...oldSetting]
      } else if (typeof baseSetting === 'object') {
        newInfo[setting] = newInfo[setting] || {}
        mergedInfo[setting] = { ...baseSetting, ...newInfo[setting] }
      } else if (typeof newInfo[setting] !== 'undefined') {
        mergedInfo[setting] = newInfo[setting]
      } else {
        mergedInfo[setting] = baseSetting
      }
    }
    mergedInfo.hdSettings = fromBips(mergedInfo.supportedBips)

    for (const setting in newInfo) {
      if (!mergedInfo[setting]) mergedInfo[setting] = newInfo[setting]
    }

    let name = network
    if (netType !== 'main') name += netType.toLowerCase()
    Object.assign(networks, { [name]: mergedInfo })
  }
}

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

export const getHDPaths = (
  network: string = 'main',
  pathParams: HDStandardPathParams = {}
): Array<HDPath> => {
  return fromSettings(networks[network].hdSettings, pathParams)
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

export const getDefaultScriptType = (network: string = 'main'): string => {
  const { hdSettings, supportedBips } = networks[network]
  for (const bip of supportedBips) {
    const scriptType = hdSettings[`${bip}'`].scriptType
    if (scriptType) return scriptType
  }
  return 'P2PKH'
}
