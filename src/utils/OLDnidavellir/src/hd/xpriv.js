// @flow

import * as API from '../../types/publicAPI.js'
import { getHDSetting, getDecoder } from '../core/networkInfo.js'
import { type ExtendedPrivateKey } from '../../types/hd.js'
import { dataFromHex, dataToHex, XKEY_DEFAULTS, HARDENED, SEED, MAX_INDEX, MAX_DEPTH, TWEAK_OUT_OF_RANGE_ERROR } from './common.js'
import { sha512Hmac, hash160 } from '../utils/hash.js'
import * as Path from './path.js'
import { toPublic as toPublicKey } from '../core/privateKey.js'
import { privateKeyTweakAdd } from '../utils/secp256k1.js'

export const fromXPriv: API.FromXKey<ExtendedPrivateKey> = (key, network) => {
  const { privateKey, chainCode } = key
  if (!privateKey) throw new Error('Missing private key')
  if (!chainCode) return fromSeed(privateKey)
  const fullKey = { ...XKEY_DEFAULTS, ...key }
  if (typeof fullKey.version !== 'number') {
    const { xpriv: { prefixHex } } = getHDSetting('xprv', network)
    fullKey.version = prefixHex
  }
  return fullKey
}

export const fromSeed: API.FromSeed<ExtendedPrivateKey> = (seed, network, version = 'xprv') => {
  const hash = sha512Hmac(SEED, seed)
  const { xpriv: { prefixHex } } = getHDSetting(version, network)
  if (typeof prefixHex !== 'number') throw new Error('')
  return fromXPriv({
    privateKey: hash.slice(0, 64),
    chainCode: hash.slice(64, 128),
    version: prefixHex
  }, network)
}

export const fromHex: API.FromHex<ExtendedPrivateKey> = (keyHex, network) => {
  // Get the byte which tells us what type of key we're expecting
  const headerByte = parseInt(keyHex.slice(90, 92), 16)
  if (headerByte !== 0) throw new Error('Wrong private key header')

  return {
    privateKey: keyHex.slice(92, 156),
    ...dataFromHex(keyHex, network)
  }
}

export const fromString: API.FromString<ExtendedPrivateKey> = (xKey, network = 'main') => {
  const keyHex = getDecoder(network, xKey.slice(0, 4)).decode(xKey)
  return fromHex(keyHex, network)
}

export const toIndex: API.ToIndex<ExtendedPrivateKey> = async (key, index, hardended = false) => {
  try {
    const { depth, version, privateKey, chainCode } = key
    if (index > MAX_INDEX) throw new Error('Index out of range.')
    if (depth >= MAX_DEPTH) throw new Error('Depth too high.')
    const publicKey = key.publicKey || await toPublicKey(privateKey, true)
    // If the index is non-hardended, set 'tweakKey' to be the publicKey, otherwise the privateKey
    let tweakKey = index < HARDENED || hardended ? publicKey : `00${privateKey}`
    tweakKey += index.toString(16).padStart(8, '0')
    const hash = sha512Hmac(chainCode, tweakKey)

    const childKey = await privateKeyTweakAdd(privateKey, hash.slice(0, 64))
    const childChainCode = hash.slice(64, 128)
    const parentFingerPrint = publicKey ? hash160(publicKey).slice(0, 8) : 0

    return {
      privateKey: childKey,
      childNumber: index,
      chainCode: childChainCode,
      depth: depth + 1,
      parentFingerPrint: parseInt(parentFingerPrint, 16),
      version
    }
  } catch (e) {
    if (!e.message.includes(TWEAK_OUT_OF_RANGE_ERROR)) throw e
    return toIndex(key, index + 1)
  }
}

export const toPath: API.ToPath<ExtendedPrivateKey> = async (key, path) => {
  if (typeof path === 'string') path = Path.fromString(path)
  for (const index of path) {
    key = await toIndex(key, index)
  }
  return key
}

export const toHex: API.ToHex<ExtendedPrivateKey> = key => {
  const { privateKey, publicKey, ...rest } = key
  if (privateKey.length !== 64) throw new Error('Wrong private key length')
  return dataToHex(rest) + `00${privateKey}`
}

export const toString: API.ToString<ExtendedPrivateKey> = (hdKey, network = 'main') =>
  getDecoder(network, hdKey.version).encode(toHex(hdKey))

export const toXPub: API.ToXPub<ExtendedPrivateKey> = async (hdKey, network) => {
  const { privateKey, version, ...rest } = hdKey
  const { xpub: { prefixHex } } = getHDSetting(hdKey.version, network)
  const publicKey = hdKey.publicKey || await toPublicKey(privateKey, true)
  return { publicKey, version: prefixHex, ...rest }
}
