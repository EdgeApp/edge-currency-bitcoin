// @flow

import {
  type DerivedKeyPair,
  type DerivedPoint,
  type KeyHmac
} from '../../types/hd.js'
import { type HexPair } from '../../types/core.js'
import { sha512Hmac } from '../utils/hash.js'
import * as Secp256k1 from '../utils/secp256k1'

export const HARDENED = 0x80000000
export const MAX_INDEX = 0xffffffff
export const TWEAK_OUT_OF_RANGE_ERROR = 'tweak out of range'

export const hmac = (key: string, data: string): KeyHmac => {
  const hash = sha512Hmac(key, data)
  const left = hash.slice(0, 64)
  const right = hash.slice(64, 128)
  return { left, right }
}

export const deriveKeyPoint = async (
  { privateKey, publicKey }: HexPair = {},
  entropy: string,
  index?: number = 0,
  hardened?: boolean = false
): Promise<DerivedPoint> => {
  if (index > MAX_INDEX) throw new Error('Index out of range.')
  let key = ''
  if (hardened && index < HARDENED) index += HARDENED
  if (index >= HARDENED) {
    if (!privateKey) {
      throw new Error('Cannot get hardened chainCode without a private key.')
    }
    key = `00${privateKey}`
  } else if (publicKey) {
    key = publicKey
  } else if (privateKey) {
    key = await Secp256k1.publicKeyCreate(privateKey, true)
  } else {
    throw new Error('Cannot derive without keys.')
  }
  key += index.toString(16).padStart(8, '0')
  const { left, right } = hmac(key, entropy)
  return { tweakPoint: left, chainCode: right, childIndex: index }
}

export const derivePublic = async (
  publicKey: string,
  index: number,
  entropy: string,
  hardened: boolean = false
): Promise<{ publicKey: string } & DerivedKeyPair> => {
  try {
    const keyPair = { publicKey }
    const { tweakPoint, ...rest } = await deriveKeyPoint(
      keyPair,
      entropy,
      index,
      hardened
    )
    const childKey = await Secp256k1.publicKeyTweakAdd(
      publicKey,
      tweakPoint,
      true
    )
    return { publicKey: childKey, ...rest }
  } catch (e) {
    if (!e.message.includes(TWEAK_OUT_OF_RANGE_ERROR)) throw e
    return derivePublic(publicKey, index + 1, entropy, hardened)
  }
}

export const derivePrivate = async (
  privateKey: string,
  index: number,
  entropy: string,
  hardened: boolean = false,
  publicKey?: string
): Promise<{ privateKey: string } & DerivedKeyPair> => {
  try {
    const keyPair = { privateKey, publicKey }
    const { tweakPoint, ...rest } = await deriveKeyPoint(
      keyPair,
      entropy,
      index,
      hardened
    )
    const childKey = await Secp256k1.privateKeyTweakAdd(privateKey, tweakPoint)
    return { privateKey: childKey, ...rest }
  } catch (e) {
    if (!e.message.includes(TWEAK_OUT_OF_RANGE_ERROR)) throw e
    if (index > MAX_INDEX) index -= HARDENED
    return derivePrivate(privateKey, index + 1, entropy, hardened, publicKey)
  }
}

export const deriveKeyPair = async (
  parentKeys: DerivedKeyPair,
  keyIndex?: string = '0'
): Promise<DerivedKeyPair> => {
  const hardened = keyIndex[keyIndex.length - 1] === "'"
  const index = hardened ? parseInt(keyIndex.slice(0, -1)) : parseInt(keyIndex)
  const { chainCode, privateKey } = parentKeys
  let publicKey = parentKeys.publicKey
  if ((hardened || index >= HARDENED) && !privateKey) {
    throw new Error('Cannot derive hardened index without a private key.')
  }
  if (privateKey) {
    const childKey = await derivePrivate(
      privateKey,
      index,
      chainCode,
      hardened,
      publicKey
    )
    const childPublicKey = await Secp256k1.publicKeyCreate(
      childKey.privateKey,
      true
    )
    return { ...childKey, publicKey: childPublicKey }
  }
  if (!publicKey) {
    if (!privateKey) throw new Error('Cannot derive without keys.')
    publicKey = await Secp256k1.publicKeyCreate(privateKey, true)
  }
  return derivePublic(publicKey, index, chainCode, hardened)
}
