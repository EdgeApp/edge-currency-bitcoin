// @flow
import type { DerivedKey, Index, ExtendedKeyPair, ExtendedMasterKeys } from './types.js'
import { deriveKeyPair, deriveMasterKeyPair } from './derive.js'
import BufferConsumer from '../utils/consumer.js'
import * as KeyPair from '../keyPair.js'
import { hash160, publicKeyCreate } from '../utils/crypto.js'
import {
  getNetwork,
  getVersion,
  checkVersion,
  getSerializer
} from '../network.js'

const MAX_DEPTH = 0xff

export const fromBuffer = (
  keyBuffer: Buffer,
  network?: string
): ExtendedKeyPair => {
  const reader = new BufferConsumer(keyBuffer)
  const version = reader.readUInt32BE()
  if (network) checkVersion(version, network)
  return {
    version,
    depth: reader.readUInt8(),
    parentFingerPrint: reader.readUInt32BE(),
    childIndex: reader.readUInt32BE(),
    chainCode: reader.readBytes(32),
    ...KeyPair.fromBuffer(reader.readBytes(33))
  }
}

export const toBuffer = (hdKey: ExtendedKeyPair, network?: string): Buffer => {
  if (network) checkVersion(hdKey.version, network)
  const buff = BufferConsumer.allocUnsafe(78)
  buff.writeUInt32BE(hdKey.version)
  buff.writeUInt8(hdKey.depth)
  buff.writeUInt32BE(hdKey.parentFingerPrint)
  buff.writeUInt32BE(hdKey.childIndex)
  buff.writeBytes(hdKey.chainCode)
  const keyPairBuf = KeyPair.toBuffer(hdKey).slice(0, 33)
  buff.writeBytes(keyPairBuf)
  return buff.getBuffer()
}

export const fromString = async (
  hdKey: string,
  network?: string
): Promise<ExtendedKeyPair> => {
  const keyBuffer = await getSerializer(network, 'xkey').decode(hdKey)
  return fromBuffer(keyBuffer, network)
}

export const toString = async (
  hdKey: ExtendedKeyPair,
  network?: string
): Promise<string> => {
  const keyBuffer = toBuffer(hdKey, network)
  return getSerializer(network, 'xkey').encode(keyBuffer)
}

export const fromParent = async (
  parentKeys: ExtendedKeyPair,
  index: Index,
  network?: string
): Promise<ExtendedKeyPair> => {
  if (parentKeys.depth >= MAX_DEPTH) throw new Error('Depth too high.')

  const derivedKey: DerivedKey<Buffer> = await deriveKeyPair(parentKeys, index)
  if (!parentKeys.publicKey) {
    parentKeys.publicKey = await publicKeyCreate(parentKeys.publicKey, true)
  }

  const parentFingerPrint = await hash160(parentKeys.publicKey).readUInt32BE(0)
  network = network || getNetwork(parentKeys.version)

  return {
    ...derivedKey,
    parentFingerPrint,
    version: getVersion(derivedKey, network),
    depth: parentKeys.depth + 1
  }
}

export const fromSeed = async (
  seed: Buffer,
  network: string
): Promise<ExtendedMasterKeys> => {
  const masterKeyPair = await deriveMasterKeyPair(seed)
  return {
    ...masterKeyPair,
    parentFingerPrint: 0,
    version: getVersion(masterKeyPair, network),
    depth: 0
  }
}
