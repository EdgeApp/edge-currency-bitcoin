// @flow

import bcoin from 'bcoin'
import { type AddressPrefix, Core } from 'nidavellir'

import { fromBaseString, toBaseString } from '../bcoinUtils/address.js'
import { cashAddressToHash, toCashAddress } from './cashAddress'

const networks = Core.Networks
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

// export const changeNetwork = (address: string, oldNetwork: string, newNetwork: string = 'bitcoin'): string => {
//   const oldPrefix = networks[oldNetwork].addressPrefix
//   const newPrefix = networks[newNetwork].addressPrefix
//   if (!isLegacy(address, oldNetwork) && oldPrefix.cashAddress) {
//     address = cashAddressToLegacy(address, oldNetwork)
//   }
//   address = changeFormat(address, oldNetwork, newPrefix)
//   return address
// }

export const toLegacyFormat = (address: string, network: string): string => {
  if (isLegacy(address, network)) return address
  const { addressPrefix, legacyAddressPrefix } = networks[network]
  if (addressPrefix.cashAddress) {
    const { hashBuffer, type } = cashAddressToHash(address)
    const prefix = networks[network].legacyAddressPrefix[type]
    if (typeof prefix !== 'number') return address
    const hash = hashBuffer.toString('hex')
    return toBaseString({ hash, type, version: -1 }, network, prefix)
  }
  return changeFormat(address, network, legacyAddressPrefix)
}

export const toNewFormat = (address: string, network: string): string => {
  if (!isLegacy(address, network)) return dirtyAddress(address, network)
  const { addressPrefix } = networks[network]
  if (addressPrefix.cashAddress) {
    const { cashAddress = '' } = networks[network].addressPrefix
    const { hash, type } = fromBaseString(address, network)
    return toCashAddress(Buffer.from(hash, 'hex'), type, cashAddress)
  }
  return changeFormat(address, network, addressPrefix)
}

export const isValidAddress = (
  displayAddress: string,
  network: string,
  prefixes?: AddressPrefix
): boolean => {
  let valid = false
  const { serializers, addressPrefix } = networks[network]

  if (!prefixes || !Object.keys(prefixes).length) {
    prefixes = addressPrefix
  }

  if (prefixes.cashAddress) {
    try {
      cashAddressToHash(dirtyAddress(displayAddress, network))
      valid = true
    } catch (e) {}
  }

  try {
    const { hrp } = bech32.decode(displayAddress)
    if (prefixes.bech32 === hrp) valid = true
  } catch (e) {}

  try {
    const addressHex = serializers.address.decode(displayAddress)
    const prefixNum = parseInt(addressHex.slice(0, 2), 16)
    for (const prefixType in prefixes) {
      if (prefixes[prefixType] === prefixNum) {
        valid = true
      }
    }
  } catch (e) {}

  return valid
}

export const isLegacy = (displayAddress: string, network: string): boolean => {
  const { legacyAddressPrefix } = networks[network]
  return isValidAddress(displayAddress, network, legacyAddressPrefix)
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
