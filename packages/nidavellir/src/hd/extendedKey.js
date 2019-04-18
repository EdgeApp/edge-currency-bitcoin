// @flow

import {
  type DerivedKey,
  type ExtendedKeyPair,
  type ExtendedMasterKeys
} from '../../types/hd.js'
import { type HexPair } from '../../types/core.js'
import * as KeyPair from '../core/keyPair.js'
import {
  validateHDKeyVersion,
  getDecoder,
  getHDSetting
} from '../core/networkInfo.js'
import { hash160 } from '../utils/hash.js'
import { publicKeyCreate } from '../utils/secp256k1.js'
import { hmac, deriveKeyPair } from './derive.js'

const MAX_DEPTH = 0xff
const SEED = '426974636f696e2073656564'

export const fromSeed = async (
  seed: string,
  network: string = 'main',
  purpose: number = 32
): Promise<ExtendedMasterKeys> => {
  const { left, right } = hmac(seed, SEED)
  const publicKey = await publicKeyCreate(left, true)
  const masterKeyPair = { privateKey: left, publicKey, chainCode: right, childIndex: 0 }
  const version = getHDSetting(network, purpose).xpriv.prefix
  return {
    ...masterKeyPair,
    parentFingerPrint: 0,
    version: parseInt(version),
    depth: 0
  }
}

export const fromIndex = async (
  parentKeys: ExtendedKeyPair,
  index: string
): Promise<ExtendedKeyPair> => {
  if (parentKeys.depth >= MAX_DEPTH) throw new Error('Depth too high.')

  const derivedKey: DerivedKey<string> = await deriveKeyPair(parentKeys, index)
  if (!parentKeys.publicKey) {
    if (!parentKeys.privateKey) {
      throw new Error('Cannot create parentFingerPrint without keys')
    }
    parentKeys.publicKey = await publicKeyCreate(parentKeys.privateKey, true)
  }
  const parentFingerPrint = await hash160(parentKeys.publicKey)

  return {
    ...derivedKey,
    parentFingerPrint: parseInt(parentFingerPrint.slice(0, 8), 16),
    version: parentKeys.version,
    depth: parentKeys.depth + 1
  }
}

export const fromHex = (keyHex: string, network?: string): ExtendedKeyPair => {
  const version = parseInt(keyHex.slice(0, 8), 16)
  if (network) validateHDKeyVersion(version, network)
  return {
    version,
    depth: parseInt(keyHex.slice(9, 10), 16),
    parentFingerPrint: parseInt(keyHex.slice(10, 18), 16),
    childIndex: parseInt(keyHex.slice(18, 26), 16),
    chainCode: keyHex.slice(26, 90),
    ...KeyPair.fromHex(keyHex.slice(90, 156))
  }
}

export const fromString = (
  hdKey: string,
  network: string = 'main'
): ExtendedKeyPair => {
  const keyHex = getDecoder(network, hdKey.slice(0, 3)).decode(hdKey)
  return fromHex(keyHex, network)
}

export const toHex = (
  hdKey: ExtendedKeyPair,
  network?: string,
  forcePublic: boolean = false
): string => {
  if (network) validateHDKeyVersion(hdKey.version, network)
  const { privateKey, publicKey } = hdKey
  const keyPair: HexPair = { publicKey }
  if (!forcePublic) keyPair.privateKey = privateKey
  return (
    hdKey.version.toString(16).padStart(8, '0') +
    hdKey.depth.toString(16).padStart(2, '0') +
    hdKey.parentFingerPrint.toString(16).padStart(8, '0') +
    hdKey.childIndex.toString(16).padStart(8, '0') +
    hdKey.chainCode +
    KeyPair.toHex(keyPair).slice(0, 66)
  )
}

export const toString = (
  hdKey: ExtendedKeyPair,
  network: string = 'main',
  forcePublic: boolean = false
): string => {
  const keyHex = toHex(hdKey, network, forcePublic)
  return getDecoder(network, hdKey.version).encode(keyHex)
}
