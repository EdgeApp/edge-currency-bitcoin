// @flow

import { Buffer } from 'buffer'
import bcoin from 'bcoin'
import { Utils, Core } from 'nidavellir'
import type { ScriptType, HexPair } from 'nidavellir'
import type { RawAddress, Address } from './types.js'
import { reverseHexString } from '../utils.js'
import { defaultScriptTypes } from './scriptTypes.js'
import { dirtyAddress } from '../addressFormat/addressFormatIndex.js'
import { cashAddressToHash, toCashAddress } from '../addressFormat/cashAddress.js'

const networks = Core.Networks
const { bech32 } = bcoin.utils
const { fromPubkeyhash, fromScripthash, fromProgram } = bcoin.script

export const fromHexString = (
  addressHex: string,
  network: string = 'main'
): RawAddress => {
  const prefixNum = parseInt(addressHex.slice(0, 2), 16)
  const type = Core.NetworkInfo.getPrefixType(prefixNum, network)
  let version = -1
  let index = 2
  if (addressHex.length > 50) {
    version = parseInt(addressHex.slice(index, index + 2), 16)
    index += 2
    if (parseInt(addressHex.slice(index, index + 2), 16) !== 0) {
      throw new Error('Bad version padding')
    }
    index += 2
  }
  const hash = addressHex.slice(index)
  return { type, version, hash }
}

export const fromBaseString = (
  displayAddress: string,
  network: string = 'main'
): RawAddress => {
  let addressHex
  const { addressPrefix, serializers } = networks[network]
  try {
    const { hrp, version, hash } = bech32.decode(displayAddress)
    if (addressPrefix.bech32 !== hrp) {
      throw new Error(`Bad bech32 prefix ${hrp} for network ${network}`)
    }
    const type = hash.length <= 40 ? 'witnesspubkeyhash' : 'witnesspubkeyhash'
    return { version, hash, type }
  } catch (e) {
    try {
      addressHex = serializers.address.decode(displayAddress)
      return fromHexString(addressHex, network)
    } catch (e) {
      if (!addressPrefix.cashAddress) throw e
      displayAddress = dirtyAddress(displayAddress, network)
      const { hashBuffer, type } = cashAddressToHash(displayAddress)
      const hash = hashBuffer.toString('hex')
      return { hash, type, version: -1, hrp: addressPrefix.cashAddress }
    }
  }
}

export const fromKeyPair = (
  keyPair: HexPair = {},
  scriptType: ScriptType = 'P2PKH',
  network: string = 'main',
  scriptHex: string = ''
): Address => {
  const { type, version, getHash, getData } = defaultScriptTypes[scriptType]
  const data = getData(keyPair, scriptHex)
  const hash = getHash(data)
  const rawAddress = { hash, type, version }
  const displayAddress = toBaseString(rawAddress, network)
  const scriptHash = toScriptHash(rawAddress)
  return { displayAddress, scriptHash }
}

export const fromWIF = async (
  wif: string,
  scriptType: ScriptType = 'P2PKH',
  network: string = 'main',
  scriptHex: string = ''
): Promise<Address> => {
  const keyPair = await Core.KeyPair.keyPairFromWIF(wif, network)
  return fromKeyPair(keyPair, scriptType, network, scriptHex)
}

export const toHexString = (
  address: RawAddress,
  network: string = 'main',
  prefixNum: number = -1
): string => {
  const { type, hash, version = -1 } = address
  if (prefixNum === -1) prefixNum = Core.NetworkInfo.getPrefixNum(type, network)
  const prefixHex = prefixNum.toString(16).padStart(2, '0')
  const versionHex = version !== -1 ? version.toString(16).padEnd(4, '0') : ''
  return `${prefixHex}${versionHex}${hash}`
}

export const toBaseString = (
  address: RawAddress,
  network: string = 'main',
  prefixNum: number = -1
): string => {
  const { hash, version = -1 } = address
  const hashBuffer = Buffer.from(hash, 'hex')
  const { addressPrefix, serializers } = networks[network]
  if (version !== -1) {
    const hrp = addressPrefix.bech32
    return bech32.encode(hrp, version, hashBuffer)
  }
  try {
    const prefixedAddress = toHexString(address, network, prefixNum)
    return serializers.address.encode(prefixedAddress)
  } catch (e) {
    if (addressPrefix.cashAddress) {
      return toCashAddress(hashBuffer, address.type, addressPrefix.cashAddress)
    }
    throw e
  }
}

export const toScript = (address: RawAddress): Object => {
  const { hash, type = 'pubkeyhash', version = -1 } = address
  let script
  const hashBuffer = Buffer.from(hash, 'hex')
  if (type === 'pubkeyhash') {
    script = fromPubkeyhash(hashBuffer)
  } else if (type === 'scripthash') {
    script = fromScripthash(hashBuffer)
  } else if (version !== -1) {
    script = fromProgram(version, hashBuffer)
  }
  if (!script) {
    throw new Error(`Unknown script type ${type} and/or version ${version}`)
  }
  return script
}

export const toScriptHash = (address: RawAddress): string => {
  const rawScript = toScript(address)
  const scriptHash = Utils.Hash.sha256(rawScript.toRaw().toString('hex'))
  return reverseHexString(scriptHash)
}

export const getAllAddresses = (
  privateKeys: Array<string>,
  network: string
): Promise<Array<Address>> => {
  const addressesPromises = []
  const { hdSettings } = networks[network]
  for (const bipNum in hdSettings) {
    const { scriptType = 'P2PKH' } = hdSettings[bipNum]
    for (const key of privateKeys) {
      addressesPromises.push(fromWIF(key, scriptType, network))
    }
  }
  return Promise.all(addressesPromises)
}
