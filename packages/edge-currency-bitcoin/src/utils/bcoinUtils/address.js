// @flow

import { Buffer } from 'buffer'

import bcoin from 'bcoin'
import { Core, type HexPair, type ScriptType, Utils } from 'nidavellir'

import { type Address, type RawAddress } from '../../../types/bcoinUtils.js'
import { dirtyAddress } from '../addressFormat/addressFormatIndex.js'
import {
  cashAddressToHash,
  toCashAddress
} from '../addressFormat/cashAddress.js'
import { reverseHexString } from '../utils.js'
import { getAllKeyRings } from './key.js'
import { defaultScriptTypes } from './scriptTypes.js'

const networks = Core.Networks
const { bech32 } = bcoin.utils
const { fromPubkeyhash, fromScripthash, fromProgram } = bcoin.script

export const fromHexString = (
  addressHex: string,
  network: string = 'main'
): RawAddress => {
  const prefixNum = parseInt(addressHex.slice(0, 2), 16)
  const scriptType = Core.NetworkInfo.getScriptType(prefixNum, network)
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
  return { scriptType, version, hash }
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
    // TODO - FIX scriptType
    const scriptType: ScriptType = hash.length <= 40 ? 'P2WPKH' : 'P2WPKH'
    return { version, hash, scriptType }
  } catch (e) {
    try {
      addressHex = serializers.address.decode(displayAddress)
      return fromHexString(addressHex, network)
    } catch (e) {
      if (!addressPrefix.cashAddress) throw e
      // kylan functionUsage - dirtyAddress - fromBaseString
      displayAddress = dirtyAddress(displayAddress, network)
      const { hashBuffer, scriptType } = cashAddressToHash(displayAddress)
      const hash = hashBuffer.toString('hex')
      return { hash, scriptType, version: -1, hrp: addressPrefix.cashAddress }
    }
  }
}

export const fromKeyPair = (
  keyPair: HexPair = {},
  scriptType: ScriptType = 'P2PKH',
  network: string = 'main',
  scriptHex: string = ''
): Address => {
  const { version, getHash, getData } = defaultScriptTypes[scriptType]
  const data = getData(keyPair, scriptHex)
  const hash = getHash(data)
  const rawAddress = { hash, scriptType, version }
  const displayAddress = toBaseString(rawAddress, network)
  const scriptHash = toScriptHash(rawAddress)
  return { displayAddress, scriptHash }
}

export const toHexString = (
  address: RawAddress,
  network: string = 'main',
  prefixNum: number = -1
): string => {
  const { scriptType, hash, version = -1 } = address
  if (prefixNum === -1) prefixNum = Core.NetworkInfo.getPrefix(scriptType, network)
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
      return toCashAddress(hashBuffer, address.scriptType, addressPrefix.cashAddress)
    }
    throw e
  }
}

export const toScript = (address: RawAddress): Object => {
  const { hash, scriptType = 'P2PKH', version = -1 } = address
  let script
  const hashBuffer = Buffer.from(hash, 'hex')
  if (scriptType === 'P2PKH') {
    script = fromPubkeyhash(hashBuffer)
  } else if (scriptType === 'P2SH') {
    script = fromScripthash(hashBuffer)
  } else if (version !== -1) {
    script = fromProgram(version, hashBuffer)
  }
  if (!script) {
    throw new Error(`Unknown script type ${scriptType} and/or version ${version}`)
  }
  return script
}

export const toScriptHash = (address: RawAddress): string => {
  const rawScript = toScript(address)
  const scriptHash = Utils.Hash.sha256(rawScript.toRaw().toString('hex'))
  return reverseHexString(scriptHash)
}

export const getAllAddresses = async (
  privateKeys: Array<string>,
  network: string
): Promise<Array<Address>> => {
  const keys = await getAllKeyRings(privateKeys, network)

  const addresses = keys.map(({ publicKey, scriptType }) =>
    fromKeyPair({ publicKey }, scriptType, network)
  )

  return addresses
}
