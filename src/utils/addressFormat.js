// @flow

import bcoin from 'bcoin'

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
  if (addressPrefix[`${type}Legacy`] === undefined) return {}
  return {
    legacyPrefix: addressPrefix[`${type}Legacy`],
    newPrefix: addressPrefix[`${type}`]
  }
}

export const toLegacyFormat = (address: string, network: string): string => {
  const { serializers = {}, addressPrefix = {} } = bcoin.networks[network] || {}
  try {
    const addressToDecode = serializers.address
      ? serializers.address.decode(address)
      : address
    // TODO write own fromBase58 function
    const addressObj = bcoin.primitives.Address.fromBase58(
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
  let newAddress = address
  try {
    if (serializers.address) {
      newAddress = serializers.address.decode(newAddress)
    }

    const addressObj = bcoin.primitives.Address.fromBase58(newAddress) // TODO write own fromBase58 function
    const { legacyPrefix, newPrefix } = getPrefixes(addressObj, addressPrefix)

    if (legacyPrefix) {
      const changedAddress = changeAddressPrefix(
        addressObj,
        newPrefix,
        legacyPrefix
      )
      if (changedAddress) {
        newAddress = changedAddress
      }
    }
  } catch (e) {}

  try {
    if (serializers.address) {
      newAddress = serializers.address.encode(newAddress)
    }
  } catch (e) {}

  return newAddress
}

export const validAddress = (address: string, network: string) => {
  const { addressPrefix = {}, serializers = {} } = bcoin.networks[network] || {}
  try {
    if (serializers.address) address = serializers.address.decode(address)
    // verify address for base58 format
    // TODO write own fromBase58 function
    const prefix = bcoin.primitives.Address.fromBase58(
      address,
      network
    ).getPrefix()
    const { pubkeyhash, scripthash } = addressPrefix
    if (prefix !== pubkeyhash && prefix !== scripthash) return false
  } catch (e) {
    try {
      // verify address for bech32 format
      const hrp = bcoin.utils.bech32.decode(address).hrp
      const { bech32 } = addressPrefix
      if (hrp !== bech32) return false
    } catch (e) {
      return false
    }
  }
  return true
}
