// @flow

import bcoin from 'bcoin'

import * as base32 from './base32.js'
import { cashAddressToHash, toCashAddress } from './cashAddress'

const legacyToCashAddress = (address: string, network: string) => {
  if (validAddress(address, network)) return address
  const { cashAddress } = bcoin.networks[network].addressPrefix
  const addressObj = bcoin.primitives.Address.fromBase58(address) // TODO write own fromBase58 function
  const type = addressObj.getType()
  const newAddress = toCashAddress(addressObj.hash, type, cashAddress)
  return newAddress
}

const changeAddressPrefix = (
  address: any,
  newPrefix: number,
  expectedPrefix: number
) => {
  const prefix = address.getPrefix()
  if (prefix !== expectedPrefix) return null
  const bw = new bcoin.utils.StaticWriter(address.getSize())
  bw.writeU8(newPrefix)
  if (address.version !== -1) {
    bw.writeU8(address.version)
    bw.writeU8(0)
  }
  bw.writeBytes(address.hash)
  bw.writeChecksum()
  return bcoin.utils.base58.encode(bw.render())
}

const getPrefixes = (addressObj: Object, addressPrefix: Object) => {
  const type = addressObj.getType()
  const legacyPrefix = addressPrefix[`${type}Legacy`] || -1
  const newPrefix = legacyPrefix !== -1 ? addressPrefix[type] : -1
  return { legacyPrefix, newPrefix }
}

export const toLegacyFormat = (address: string, network: string): string => {
  const { serializers = {}, addressPrefix = {} } = bcoin.networks[network] || {}
  if (addressPrefix.cashAddress) return cashAddressToLegacy(address, network)
  try {
    const addressToDecode = serializers.address
      ? serializers.address.decode(address)
      : address
    const addressObj = bcoin.primitives.Address.fromBase58( // TODO write own fromBase58 function
      addressToDecode,
      network
    )
    const { legacyPrefix, newPrefix } = getPrefixes(addressObj, addressPrefix)
    return changeAddressPrefix(addressObj, legacyPrefix, newPrefix) || address
  } catch (e) {
    return address
  }
}

export const toNewFormat = (address: string, network: string): string => {
  const { serializers = {}, addressPrefix = {} } = bcoin.networks[network] || {}
  if (addressPrefix.cashAddress) return legacyToCashAddress(address, network)
  try {
    const addressToDecode = serializers.address
      ? serializers.address.decode(address)
      : address
    const addressObj = bcoin.primitives.Address.fromBase58(addressToDecode) // TODO write own fromBase58 function
    const { legacyPrefix, newPrefix } = getPrefixes(addressObj, addressPrefix)
    return changeAddressPrefix(addressObj, newPrefix, legacyPrefix) || address
  } catch (e) {
    return address
  }
}

const cashAddressToLegacy = (address: string, network: string) => {
  const { addressPrefix = {} } = bcoin.networks[network] || {}
  try {
    bcoin.primitives.Address.fromBase58(address) // TODO write own fromBase58 function
    return address
  } catch (e) {}
  // Convert the Address string into hash, network and type
  const addressInfo = cashAddressToHash(address, addressPrefix.cashAddress)
  const { hashBuffer, type } = addressInfo
  return bcoin.primitives.Address.fromHash(
    hashBuffer,
    type,
    -1,
    network
  ).toBase58()
}

export const validAddress = (address: string, network: string) => {
  const { addressPrefix = {}, serializers = {} } = bcoin.networks[network] || {}
  if (addressPrefix.cashAddress) {
    // verify address for cashAddress format
    try {
      base32.decode(address)
      address = cashAddressToLegacy(address, network)
    } catch (e) {
      return false
    }
  }
  try {
    if (serializers.address) address = serializers.address.decode(address)
    // verify address for base58 format
    const prefix = bcoin.primitives.Address.fromBase58( // TODO write own fromBase58 function
      address,
      network
    ).getPrefix()
    const { pubkeyhash, scripthash } = bcoin.networks[network].addressPrefix
    if (prefix !== pubkeyhash && prefix !== scripthash) return false
  } catch (e) {
    try {
      // verify address for bech32 format
      const hrp = bcoin.utils.bech32.decode(address).hrp
      const { bech32 } = bcoin.networks[network].addressPrefix
      if (hrp !== bech32) return false
    } catch (e) {
      return false
    }
  }
  return true
}
