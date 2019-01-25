// @flow
import type { Base, NetworkSettings } from './types.js'
import { base } from './utils/base.js'

const bs58check = base['58'].check

export const Networks = {}

export const getAllNetworks = (): { [network: string]: NetworkSettings } => {
  const settings = {}
  for (const network in Networks) {
    settings[network] = Networks[network]
  }
  return settings
}

export const getVersion = (
  hdKey: { privateKey?: any, publicKey?: any },
  network: string
) => {
  const { keyPrefix = {} } = Networks[network]
  if (hdKey.privateKey) return keyPrefix.xprivkey
  if (hdKey.publicKey) return keyPrefix.xpubkey
  throw new Error("Can't get version without a key")
}

export const getSerializer = (network?: string, type?: string): Base => {
  if (!network || !type) return bs58check
  const { serializers = {} } = Networks[network] || {}
  return serializers[type] || bs58check
}

export const getNetwork = (version: number) => {
  const settings = getAllNetworks()
  for (const network in settings) {
    try {
      checkVersion(version, network)
      return network
    } catch (e) {}
  }
  throw new Error('Unknown network version')
}

export const checkVersion = (version: number, network: string) => {
  const { keyPrefix = {} } = Networks[network]
  if (version) {
    for (const prefix in keyPrefix) {
      if (keyPrefix[prefix] === version) return version
    }
    throw new Error('Wrong key prefix for network')
  }
}
