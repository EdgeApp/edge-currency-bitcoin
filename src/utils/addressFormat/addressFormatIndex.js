// @flow

import bcoin from 'bcoin'
import { toCashAddress, cashAddressToHash } from './cashAddress'

export const toLegacyFormat = (address: string, network?: string): string => {
  if (typeof address !== 'string' || !address.includes('bitcoincash')) return address
  // Convert the Address string into hash, network and type
  const addressInfo = cashAddressToHash(address)
  const { hashBuffer, type } = addressInfo
  if (
    typeof network !== 'string' &&
    typeof addressInfo.network === 'string'
  ) network = addressInfo.network
  if (!network) throw new Error('Unknown Network')
  if (type === 'pubkeyhash') {
    return bcoin.primitives.Address.fromPubkeyhash(hashBuffer, network).toBase58()
  } else if (type === 'scripthash') {
    return bcoin.primitives.Address.fromScripthash(hashBuffer, network).toBase58()
  } else {
    throw new Error('Unknown Address type')
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
    newAddressFormat.prefix,
    newAddressFormat.prefixArray
  )
  return newAddress
}
