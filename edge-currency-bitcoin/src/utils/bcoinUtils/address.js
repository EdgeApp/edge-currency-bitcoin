// @flow

import { Buffer } from 'buffer'
import bcoin from 'bcoin'
import { Utils, Commons } from 'perian'
import type { ScriptType, KeyPair } from 'perian'
import type { RawAddress, Address } from './types.js'
import { reverseHexString } from '../utils.js'
import { defaultScriptTypes } from './scriptTypes.js'

const { bech32 } = bcoin.utils
const { fromPubkeyhash, fromScripthash, fromProgram } = bcoin.script

export const fromHexString = (
  addressHex: string,
  network: string = 'main'
): RawAddress => {
  const prefixNum = parseInt(addressHex.slice(0, 2), 16)
  const type = Commons.Network.getPrefixType(prefixNum, network)
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
  const networkInfo = Commons.Network.networks[network]
  try {
    const { hrp, version, hash } = bech32.decode(displayAddress)
    if (networkInfo.addressPrefix.bech32 !== hrp) {
      throw new Error(`Bad bech32 prefix ${hrp} for network ${network}`)
    }
    const type = hash.length <= 40 ? 'witnesspubkeyhash' : 'witnesspubkeyhash'
    return { version, hash, type }
  } catch (e) {
    addressHex = networkInfo.serializers.address.decode(displayAddress)
    return fromHexString(addressHex, network)
  }
}

export const fromKeyPair = (
  keyPair: KeyPair<string> = {},
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
  const keyPair = await Commons.KeyPair.keyPairFromWIF(wif, network)
  return fromKeyPair(keyPair, scriptType, network, scriptHex)
}

export const toHexString = (
  address: RawAddress,
  network: string = 'main',
  prefixNum: number = -1
): string => {
  const { type, hash, version = -1 } = address
  if (prefixNum === -1) prefixNum = Commons.Network.getPrefixNum(type, network)
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
  let displayAddress
  const networkInfo = Commons.Network.networks[network]
  if (version === -1) {
    const prefixedAddress = toHexString(address, network, prefixNum)
    displayAddress = networkInfo.serializers.address.encode(prefixedAddress)
  } else {
    const hrp = networkInfo.addressPrefix.bech32
    const hashBuffer = Buffer.from(hash, 'hex')
    displayAddress = bech32.encode(hrp, version, hashBuffer)
  }
  return displayAddress
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
  const scriptHash = Utils.Crypto.sha256(rawScript.toRaw().toString('hex'))
  return reverseHexString(scriptHash)
}

export const getAllAddresses = (
  privateKeys: Array<string>,
  network: string
): Promise<Array<Address>> => {
  const addressesPromises = []
  const { hdSettings } = Commons.Network.networks[network]
  for (const bipNum in hdSettings) {
    const { scriptType = 'P2PKH' } = hdSettings[bipNum]
    for (const key of privateKeys) {
      addressesPromises.push(fromWIF(key, scriptType, network))
    }
  }
  return Promise.all(addressesPromises)
}
