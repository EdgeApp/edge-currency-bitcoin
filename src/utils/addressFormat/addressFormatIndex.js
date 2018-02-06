// @flow

import bcoin from 'bcoin'
import { toCashAddress, cashAddressToHash } from './cashAddress'
import * as base32 from '../base32'

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
  switch (type) {
    case 'pubkeyhash':
      return bcoin.primitives.Address.fromPubkeyhash(
        hashBuffer,
        network
      ).toBase58()
    case 'scripthash':
      return bcoin.primitives.Address.fromScripthash(
        hashBuffer,
        network
      ).toBase58()
    default:
      throw new Error('Unknown Address type')
  }
}

const toBase58 = (address, network) => {
  const prefix = bcoin.networks[network].addressPrefix.legacy
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
      const prefix = bcoin.primitives.Address.fromBase58(address).getPrefix()
      if (prefix === bcoin.networks[network].addressPrefix.pubkeyhash) {
        return address
      }
      return toBase58(bcoin.primitives.Address.fromBase58(address), network)
    default:
      return address
  }
}

export const toNewFormat = (address: string, network: string): string => {
  if (
    typeof address !== 'string' ||
    address.includes('bitcoincash') ||
    typeof network !== 'string' ||
    !network.includes('bitcoincash')
  ) {
    return address
  }
  const { newAddressFormat } = bcoin.networks[network]
  const addressObj = bcoin.primitives.Address.fromBase58(address)
  const type = address.slice(0, 1)[0] === '3' ? 'scripthash' : 'pubkeyhash'
  const newAddress = toCashAddress(
    addressObj.hash,
    type,
    newAddressFormat.prefix
  )
  return newAddress
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
