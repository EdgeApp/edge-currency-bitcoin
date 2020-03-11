// @flow

import * as API from '../../types/publicAPI.js'
import { type ExtendedPublicKey } from '../../types/hd.js'
import { getDecoder, getHDSetting } from '../core/networkInfo.js'
import { dataFromHex, dataToHex, XKEY_DEFAULTS, HARDENED, MAX_INDEX, MAX_DEPTH, TWEAK_OUT_OF_RANGE_ERROR } from './common.js'
import { sha512Hmac, hash160 } from '../utils/hash.js'
import { publicKeyTweakAdd } from '../utils/secp256k1.js'
import * as Path from './path.js'

export const fromXPub: API.FromXKey<ExtendedPublicKey> = (key, network) => {
  const { publicKey, chainCode, ...rest } = key
  if (!publicKey) throw new Error('Missing public key')
  if (!chainCode) throw new Error('Missing chainCode')
  const xKey = { ...XKEY_DEFAULTS, publicKey, chainCode, ...rest }
  if (!xKey.version) {
    const { xpub: { prefixHex } } = getHDSetting('xpub', network)
    xKey.version = prefixHex
  }
  return xKey
}

export const fromHex: API.FromHex<ExtendedPublicKey> = (keyHex, network) => {
  // Get the byte which tells us what type of key we're expecting
  const headerByte = parseInt(keyHex.slice(90, 92), 16)
  if (headerByte !== 2 && headerByte !== 3) throw new Error('Wrong public key header')

  return {
    publicKey: keyHex.slice(90, 156),
    ...dataFromHex(keyHex, network)
  }
}

export const fromString: API.FromString<ExtendedPublicKey> = (hdKey, network = 'main') => {
  const keyHex = getDecoder(network, hdKey.slice(0, 4)).decode(hdKey)
  return fromHex(keyHex, network)
}

export const toIndex: API.ToIndex<ExtendedPublicKey> = async (key, index) => {
  try {
    const { depth, version, publicKey, chainCode } = key
    if (index >= HARDENED) throw new Error('Cannot derive hardened index from a public key')
    if (index > MAX_INDEX) throw new Error('Index out of range.')
    if (depth >= MAX_DEPTH) throw new Error('Depth too high.')

    const tweakKey = publicKey + index.toString(16).padStart(8, '0')
    const hash = sha512Hmac(chainCode, tweakKey)
    const childKey = await publicKeyTweakAdd(publicKey, hash.slice(0, 64))
    const childChainCode = hash.slice(64, 128)
    const parentFingerPrint = hash160(publicKey).slice(0, 8)

    return {
      publicKey: childKey,
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

export const toPath: API.ToPath<ExtendedPublicKey> = async (key, path) => {
  if (typeof path === 'string') path = Path.fromString(path, 'M')
  for (const index of path) {
    key = await toIndex(key, index)
  }
  return key
}

export const toHex: API.ToHex<ExtendedPublicKey> = ({ publicKey, ...rest }) =>
  dataToHex(rest) + publicKey

export const toString: API.ToString<ExtendedPublicKey> = (key, network = 'main') =>
  getDecoder(network, key.version).encode(toHex(key))
