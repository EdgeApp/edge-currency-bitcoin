// @flow

import bcoin from 'bcoin'
import { toCashAddress, cashAddressToHash } from './cashAddress'
import * as base32 from './base32.js'

const legacyToCashAddress = (address: string, network: string) => {
  if (validAddress(address, network)) return dirtyAddress(address, network)
  const { cashAddress } = bcoin.networks[network].addressPrefix
  const addressObj = bcoin.primitives.Address.fromBase58(address)
  const type = addressObj.getType()
  const newAddress = toCashAddress(addressObj.hash, type, cashAddress)
  return newAddress
}

const toBase58 = (address: any, prefix: number) => {
  const bw = new bcoin.utils.StaticWriter(address.getSize())
  bw.writeU8(prefix)
  if (address.version !== -1) {
    bw.writeU8(address.version)
    bw.writeU8(0)
  }
  bw.writeBytes(address.hash)
  bw.writeChecksum()
  return bcoin.utils.base58.encode(bw.render())
}

export const switchLegacy = (
  address: string,
  network: string,
  mode: string
) => {
  const { addressPrefix = {} } = bcoin.networks[network] || {}
  if (addressPrefix.cashAddress) {
    if (mode === 'toLegacy') return cashAddressToLegacy(address, network)
    if (mode === 'toNew') return legacyToCashAddress(address, network)
  }
  try {
    let addressObj = {}
    if (mode === 'toLegacy') {
      addressObj = bcoin.primitives.Address.fromBase58(address, network)
    }
    if (mode === 'toNew') {
      addressObj = bcoin.primitives.Address.fromBase58(address)
    }
    const type = addressObj.getType()
    const legacyPrefix = addressPrefix[`${type}Legacy`]
    if (!legacyPrefix) return address
    const prefix = addressObj.getPrefix()
    const newPrefix = addressPrefix[type]
    if (mode === 'toLegacy' && prefix === newPrefix) {
      return toBase58(addressObj, legacyPrefix)
    }
    if (mode === 'toNew' && prefix === legacyPrefix) {
      return toBase58(addressObj, newPrefix)
    }
    return address
  } catch (e) {
    return address
  }
}

export const toLegacyFormat = (address: string, network: string): string => {
  return switchLegacy(address, network, 'toLegacy')
}

export const toNewFormat = (address: string, network: string): string => {
  return switchLegacy(address, network, 'toNew')
}

const cashAddressToLegacy = (address: string, network: string) => {
  const { addressPrefix = {} } = bcoin.networks[network] || {}
  if (!address.includes(`${addressPrefix.cashAddress}`)) {
    try {
      bcoin.primitives.Address.fromBase58(address)
      return address
    } catch (e) {
      address = `${addressPrefix.cashAddress}:${address}`
    }
  }
  // Convert the Address string into hash, network and type
  const addressInfo = cashAddressToHash(address)
  const { hashBuffer, type } = addressInfo
  return bcoin.primitives.Address.fromHash(
    hashBuffer,
    type,
    -1,
    network
  ).toBase58()
}

export const validAddress = (address: string, network: string) => {
  const { addressPrefix = {} } = bcoin.networks[network] || {}
  if (addressPrefix.cashAddress) {
    try {
      if (!address.includes(`${addressPrefix.cashAddress}`)) {
        base32.decode(address)
        address = `${addressPrefix.cashAddress}:${address}`
      }
      address = cashAddressToLegacy(address, network)
    } catch (e) {
      return false
    }
  }
  try {
    const prefix = bcoin.primitives.Address.fromBase58(
      address,
      network
    ).getPrefix()
    const { pubkeyhash, scripthash } = bcoin.networks[network].addressPrefix
    if (prefix !== pubkeyhash && prefix !== scripthash) return false
  } catch (e) {
    try {
      const hrp = bcoin.utils.bech32.decode(address).hrp
      const { bech32 } = bcoin.networks[network].addressPrefix
      if (hrp !== bech32) return false
    } catch (e) {
      return false
    }
  }
  return true
}

export const sanitizeAddress = (address: string, network: string) => {
  const { addressPrefix = {} } = bcoin.networks[network] || {}
  if (
    addressPrefix.cashAddress &&
    address.includes(addressPrefix.cashAddress)
  ) {
    return address.split(':')[1]
  }
  return address
}

export const dirtyAddress = (address: string, network: string) => {
  const { addressPrefix = {} } = bcoin.networks[network] || {}
  if (
    addressPrefix.cashAddress &&
    !address.includes(addressPrefix.cashAddress)
  ) {
    return `${addressPrefix.cashAddress}:${address}`
  }
  return address
}
