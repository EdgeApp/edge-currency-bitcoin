// @flow

import type { Base } from '../../types/base.js'
import type { NetworkInfo, NetworkInfos } from '../../types/network.js'
import { base } from '../utils/base.js'
import { hash256 } from '../utils/crypto.js'

const bs58check = base['58'].check

const main: NetworkInfo = {
  magic: 0xd9b4bef9,
  supportedBips: [44, 32],
  forks: [],
  keyPrefix: {
    privkey: 0x80,
    xpubkey: 0x0488b21e,
    xprivkey: 0x0488ade4,
    xpubkey58: 'xpub',
    xprivkey58: 'xprv',
    coinType: 0
  },
  addressPrefix: {
    pubkeyhash: 0x00,
    scripthash: 0x05
  },
  replayProtection: {
    forkSighash: 0x00,
    forcedMinVersion: 0,
    forkId: 0
  },
  serializers: {
    address: bs58check,
    wif: bs58check,
    xkey: bs58check,
    txHash: hash256,
    sigHash: hash256
  }
}

const testnet: NetworkInfo = {
  ...main,
  magic: 0x0709110b,
  keyPrefix: {
    privkey: 0xef,
    xpubkey: 0x043587cf,
    xprivkey: 0x04358394,
    xpubkey58: 'tpub',
    xprivkey58: 'tprv',
    coinType: 1
  },
  addressPrefix: {
    pubkeyhash: 0x6f,
    scripthash: 0xc4
  }
}

export const Networks: NetworkInfos = { main, testnet }

export const addNetworks = (networks: { [network: string]: NetworkInfos }) => {
  for (const network in networks) {
    addNetwork(network, networks[network])
  }
}

export const addNetwork = (network: string, infos: NetworkInfos = {}) => {
  for (const netType in infos) {
    const newInfo = infos[netType]
    const baseInfo = Networks[netType]
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
    let name = network
    if (netType !== 'main') name += netType.toLowerCase()
    Object.assign(Networks, { [name]: mergedInfo })
  }
}

export const getVersion = (
  hdKey: { privateKey?: any, publicKey?: any },
  network: string = 'main'
) => {
  const { keyPrefix = {} } = Networks[network]
  if (hdKey.privateKey) return keyPrefix.xprivkey
  if (hdKey.publicKey) return keyPrefix.xpubkey
  throw new Error("Can't get version without a key")
}

export const getSerializer = (
  network: string = 'main',
  type?: string
): Base => {
  if (!type) return bs58check
  const { serializers = {} } = Networks[network] || {}
  return serializers[type] || bs58check
}

export const getNetwork = (version: number): string => {
  for (const network in Networks) {
    try {
      checkVersion(version, network)
      return network
    } catch (e) {}
  }
  throw new Error('Unknown network version')
}

export const checkVersion = (version: number, network: string = 'main') => {
  const { keyPrefix = {} } = Networks[network]
  if (version) {
    for (const prefix in keyPrefix) {
      if (keyPrefix[prefix] === version) return version
    }
    throw new Error('Wrong key prefix for network')
  }
}
