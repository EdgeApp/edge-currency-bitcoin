// @flow
import type { Index, KeyHmac, DerivedPoint, DerivedKeyPair, DerivedMasterKeys } from './types.js'
import type { KeyPair } from '../types.js'
import {
  publicKeyCreate,
  privateKeyTweakAdd,
  publicKeyTweakAdd,
  hmac as Hmac
} from '../utils/crypto.js'

export const SEED = Buffer.from('Bitcoin seed', 'ascii')
export const ZERO_HEX =
  '0000000000000000000000000000000000000000000000000000000000000000'
export const HARDENED = 0x80000000
export const MAX_INDEX = 0xffffffff
export const TWEAK_OUT_OF_RANGE_ERROR = 'tweak out of range'
export const UINT8_ZERO = Buffer.from(ZERO_HEX.slice(0, 2), 'hex')
export const UINT32_ZERO = Buffer.from(ZERO_HEX.slice(0, 8), 'hex')
export const UINT256_ZERO = Buffer.from(ZERO_HEX, 'hex')

const hmac = (key: Buffer, data: Buffer): KeyHmac => {
  const hash = Hmac('sha512', key, data)
  const left = hash.slice(0, 32)
  const right = hash.slice(32, 64)
  return { left, right }
}

export const deriveKeyPoint = async (
  { privateKey, publicKey }: KeyPair<Buffer> = {},
  entropy: Buffer,
  index?: number = 0,
  hardened?: boolean = false
): Promise<DerivedPoint> => {
  if (index > MAX_INDEX) throw new Error('Index out of range.')

  const key = Buffer.allocUnsafe(37)
  if (hardened && index < HARDENED) index += HARDENED
  if (index >= HARDENED) {
    if (!privateKey) {
      throw new Error('Cannot get hardened chainCode without a private key.')
    }
    key[0] = 0
    key.fill(privateKey, 1)
  } else {
    const pubKey = publicKey || (await publicKeyCreate(privateKey, true))
    key.fill(pubKey, 0)
  }
  key.writeUInt32BE(index, 33)
  const { left, right } = hmac(key, entropy)
  return { tweakPoint: left, chainCode: right, childIndex: index }
}

export const derivePublic = async (
  publicKey: Buffer,
  index: number,
  entropy: Buffer,
  hardened: boolean = false
): Promise<DerivedKeyPair> => {
  try {
    const keyPair = { publicKey }
    const {
      tweakPoint,
      ...rest
    } = await deriveKeyPoint(keyPair, entropy, index, hardened)
    const childKey = await publicKeyTweakAdd(publicKey, tweakPoint, true)
    return { publicKey: childKey, ...rest }
  } catch (e) {
    if (!e.message.includes(TWEAK_OUT_OF_RANGE_ERROR)) throw e
    return derivePublic(publicKey, index + 1, entropy, hardened)
  }
}

export const derivePrivate = async (
  privateKey: Buffer,
  index: number,
  entropy: Buffer,
  hardened: boolean = false,
  publicKey?: Buffer
): Promise<DerivedKeyPair> => {
  try {
    const keyPair = { privateKey, publicKey }
    const {
      tweakPoint,
      ...rest
    } = await deriveKeyPoint(keyPair, entropy, index, hardened)
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
  keyIndex?: Index = '0'
): Promise<DerivedKeyPair> => {
  const hardened = keyIndex[keyIndex.length - 1] === '\''
  const index = hardened ? parseInt(keyIndex.slice(0, -1)) : parseInt(keyIndex)
  const { chainCode, privateKey } = parentKeys
  let publicKey = parentKeys.publicKey
  if (hardened || index >= HARDENED) {
    if (!privateKey) throw new Error('Cannot derive hardened index without a private key.')
    const childKey = await derivePrivate(privateKey, index, chainCode, hardened, publicKey)
    const childPublicKey = await publicKeyCreate(childKey.privateKey, true)
    return { ...childKey, publicKey: childPublicKey }
  }
  if (!publicKey) publicKey = await publicKeyCreate(privateKey, true)
  return derivePublic(publicKey, index, chainCode, hardened)
}

export const deriveMasterKeyPair = async (seed: Buffer): Promise<DerivedMasterKeys> => {
  const { left, right } = hmac(SEED, seed)
  const publicKey = await publicKeyCreate(left, true)
  return { privateKey: left, publicKey, chainCode: right, childIndex: 0 }
}
