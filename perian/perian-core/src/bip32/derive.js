// @flow
import type {
  DerivedKeyPair,
  DerivedMasterKeys,
  DerivedPoint,
  KeyHmac
} from '../../types/derivedKey.js'
import type { KeyPair } from '../../types/keyPair.js'
import {
  hmac as Hmac,
  privateKeyTweakAdd,
  publicKeyCreate,
  publicKeyTweakAdd
} from '../utils/crypto.js'

export const SEED = '426974636f696e2073656564'
export const ZERO_HEX =
  '0000000000000000000000000000000000000000000000000000000000000000'
export const HARDENED = 0x80000000
export const MAX_INDEX = 0xffffffff
export const TWEAK_OUT_OF_RANGE_ERROR = 'tweak out of range'
export const UINT8_ZERO = Buffer.from(ZERO_HEX.slice(0, 2), 'hex')
export const UINT32_ZERO = Buffer.from(ZERO_HEX.slice(0, 8), 'hex')
export const UINT256_ZERO = Buffer.from(ZERO_HEX, 'hex')

const hmac = (key: string, data: string): KeyHmac => {
  const hash = Hmac('sha512', key, data)
  const left = hash.slice(0, 64)
  const right = hash.slice(64, 128)
  return { left, right }
}

export const deriveKeyPoint = async (
  { privateKey, publicKey }: KeyPair<string> = {},
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
    key = await publicKeyCreate(privateKey, true)
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
    const childKey = await publicKeyTweakAdd(publicKey, tweakPoint, true)
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
    const childKey = await privateKeyTweakAdd(privateKey, tweakPoint)
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
  if (hardened || index >= HARDENED) {
    if (!privateKey) {
      throw new Error('Cannot derive hardened index without a private key.')
    }
    const childKey = await derivePrivate(
      privateKey,
      index,
      chainCode,
      hardened,
      publicKey
    )
    const childPublicKey = await publicKeyCreate(childKey.privateKey, true)
    return { ...childKey, publicKey: childPublicKey }
  }
  if (!publicKey) {
    if (!privateKey) throw new Error('Cannot derive without keys.')
    publicKey = await publicKeyCreate(privateKey, true)
  }
  return derivePublic(publicKey, index, chainCode, hardened)
}

export const deriveMasterKeyPair = async (
  seed: string
): Promise<DerivedMasterKeys> => {
  const { left, right } = hmac(seed, SEED)
  const publicKey = await publicKeyCreate(left, true)
  return { privateKey: left, publicKey, chainCode: right, childIndex: 0 }
}
