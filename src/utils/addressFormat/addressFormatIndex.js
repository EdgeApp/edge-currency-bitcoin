// @flow

import bcoin from 'bcoin'
import { toCashAddress, cashAddressToHash } from './cashAddress'
import * as base32 from './base32.js'

const bitcoincashLegacy = (address, network) => {
  if (typeof address !== 'string' || !address.includes(`${network}`)) {
    try {
      bcoin.primitives.Address.fromBase58(address)
      return address
    } catch (e) {
      address = `bitcoincash:${address}`
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

const bitcoincashNewFormat = (address, network) => {
  if (validAddress(address, network)) return dirtyAddress(address, network)
  const { cashAddress } = bcoin.networks[network].addressPrefix
  const addressObj = bcoin.primitives.Address.fromBase58(address)
  const type = addressObj.getType()
  const newAddress = toCashAddress(addressObj.hash, type, cashAddress)
  return newAddress
}

const toBase58 = (address, prefix) => {
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

export const toLegacyFormat = (address: string, network: string): string => {
  switch (network) {
    case 'bitcoincash':
      return bitcoincashLegacy(address, network)
    case 'bitcoincashtestnet':
      return bitcoincashLegacy(address, network)
    case 'litecoin':
      const addressObj = bcoin.primitives.Address.fromBase58(address)
      const { addressPrefix } = bcoin.networks[network]
      const prefix = addressObj.getPrefix()
      const type = addressObj.getType()
      const legacyPrefix = addressPrefix[`${type}Legacy`]
      const newPrefix = addressPrefix[type]
      if (legacyPrefix && prefix === newPrefix) {
        return toBase58(addressObj, legacyPrefix)
      }
      return address
    default:
      return address
  }
}

export const toNewFormat = (address: string, network: string): string => {
  switch (network) {
    case 'bitcoincash':
      return bitcoincashNewFormat(address, network)
    case 'bitcoincashtestnet':
      return bitcoincashNewFormat(address, network)
    case 'litecoin':
      const addressObj = bcoin.primitives.Address.fromBase58(address)
      const { addressPrefix } = bcoin.networks[network]
      const prefix = addressObj.getPrefix()
      const type = addressObj.getType()
      const legacyPrefix = addressPrefix[`${type}Legacy`]
      const newPrefix = addressPrefix[type]
      if (prefix === legacyPrefix) {
        return toBase58(addressObj, newPrefix)
      }
      return address
    default:
      return address
  }
}

export const validAddress = (address: string, network: string) => {
  if (network.includes('bitcoincash')) {
    try {
      if (!address.includes(`${network}`)) {
        base32.decode(address)
        address = `bitcoincash:${address}`
      }
      address = bitcoincashLegacy(address, network)
    } catch (e) {
      return false
    }
  }
  try {
    const prefix = bcoin.primitives.Address.fromBase58(address).getPrefix()
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
  if (network.includes('bitcoincash') && address.includes(':')) {
    return address.split(':')[1]
  }
  return address
}

export const dirtyAddress = (address: string, network: string) => {
  if (network.includes('bitcoincash') && !address.includes(':')) {
    return `${network}:${address}`
  }
  return address
}
