// @flow

import type { AddressPrefix } from 'perian'
import bcoin from 'bcoin'
import { Commons } from 'perian'
import { toBaseString, fromBaseString } from '../bcoinUtils/address.js'

import { cashAddressToHash, toCashAddress } from './cashAddress'
const { networks } = Commons.Network
const { bech32 } = bcoin.utils

export const changeFormat = (
  address: string,
  network: string,
  addressPrefix: AddressPrefix
): string => {
  try {
    const rawAddress = fromBaseString(address, network)
    const prefix = addressPrefix[rawAddress.type]
    if (typeof prefix !== 'number') return address
    return toBaseString(rawAddress, network, prefix)
  } catch (e) {
    return address
  }
}

export const toLegacyFormat = (address: string, network: string): string => {
  if (isLegacy(address, network)) return address
  const { addressPrefix, legacyAddressPrefix } = networks[network]
  if (addressPrefix.cashAddress) return cashAddressToLegacy(address, network)
  return changeFormat(address, network, legacyAddressPrefix)
}

export const toNewFormat = (address: string, network: string): string => {
  if (!isLegacy(address, network)) return dirtyAddress(address, network)
  const { addressPrefix } = networks[network]
  if (addressPrefix.cashAddress) return legacyToCashAddress(address, network)
  return changeFormat(address, network, addressPrefix)
}

const legacyToCashAddress = (address: string, network: string) => {
  const { cashAddress = '' } = networks[network].addressPrefix
  const { hash, type } = fromBaseString(address, network)
  return toCashAddress(Buffer.from(hash, 'hex'), type, cashAddress)
}

const cashAddressToLegacy = (address: string, network: string) => {
  const { hashBuffer, type } = cashAddressToHash(address)
  const prefix = networks[network].legacyAddressPrefix[type]
  if (typeof prefix !== 'number') return address
  const hash = hashBuffer.toString('hex')
  return toBaseString({ hash, type, version: -1 }, network, prefix)
}

export const getAddressPrefix = (
  displayAddress: string,
  network: string,
  prefixes?: AddressPrefix
): string | null => {
  const { serializers, addressPrefix } = Commons.Network.networks[network]
  prefixes = prefixes || addressPrefix

  if (prefixes.cashAddress) {
    try {
      cashAddressToHash(dirtyAddress(displayAddress, network))
      return 'cashAddress'
    } catch (e) {}
  }

  try {
    const { hrp } = bech32.decode(displayAddress)
    if (prefixes.bech32 === hrp) return 'bech32'
  } catch (e) {}

  try {
    const addressHex = serializers.address.decode(displayAddress)
    const prefixNum = parseInt(addressHex.slice(0, 2), 16)
    for (const prefixType in prefixes) {
      if (prefixes[prefixType] === prefixNum) {
        return prefixType
      }
    }
  } catch (e) {}

  return null
}

export const isLegacy = (displayAddress: string, network: string): boolean => {
  const { legacyAddressPrefix } = Commons.Network.networks[network]
  const type = getAddressPrefix(displayAddress, network, legacyAddressPrefix)
  return !!type
}

export const sanitizeAddress = (address: string, network: string) => {
  const { cashAddress } = networks[network].addressPrefix
  return cashAddress && address.startsWith(cashAddress)
    ? address.replace(`${cashAddress}:`, '')
    : address
}

export const dirtyAddress = (address: string, network: string) => {
  const { cashAddress } = networks[network].addressPrefix
  return cashAddress && !address.startsWith(cashAddress)
    ? `${cashAddress}:${address}`
    : address
}
