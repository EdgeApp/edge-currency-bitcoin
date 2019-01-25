// @flow
import type { KeyPair } from './types.js'
import {
  publicKeyCreate,
  sign as Sign,
  verify as Verify
} from './utils/crypto.js'

export const fromBuffer = (keyBuffer: Buffer): KeyPair<Buffer> => {
  if (keyBuffer.length !== 33 && keyBuffer.length !== 66) {
    throw new Error('Wrong key pair length')
  }
  try {
    if (keyBuffer.readUInt8(0) !== 0) throw new Error('Bad Private key prefix')
    const keyPair: KeyPair<Buffer> = { privateKey: keyBuffer.slice(1, 33) }
    if (keyBuffer.length === 66) {
      const headerByte = keyBuffer.readUInt8(33)
      if (headerByte !== 2 && headerByte !== 3) {
        throw new Error('Bad Public key prefix')
      }
      const pub = { publicKey: keyBuffer.slice(33, 66) }
      Object.assign(keyPair, pub)
    }
    return keyPair
  } catch (e) {
    const headerByte = keyBuffer.readUInt8(0)
    if (headerByte !== 2 && headerByte !== 3) {
      throw new Error('Bad Public key prefix')
    }
    return { publicKey: keyBuffer.slice(0, 33) }
  }
}

export const toBuffer = (keyPair: KeyPair<Buffer>): Buffer => {
  const pubBuf = keyPair.publicKey
    ? Buffer.from(keyPair.publicKey)
    : Buffer.alloc(0)

  if (keyPair.privateKey) {
    const priv = keyPair.privateKey
    const privBuf = Buffer.alloc(33).fill(priv, 1, 33)
    return Buffer.concat([privBuf, pubBuf])
  }

  if (!pubBuf) throw new Error('Missing key')
  return pubBuf
}

export const sign = async (
  keyPair: KeyPair<Buffer>,
  msg: Buffer
): Promise<Buffer> => {
  if (!keyPair.privateKey) throw new Error('Cannot sign without private key.')
  const signature = await Sign(msg, keyPair.privateKey)
  return signature
}

export const verify = async (
  keyPair: KeyPair<Buffer>,
  msg: Buffer,
  signature: Buffer
): Promise<Boolean> => {
  if (!keyPair.publicKey && !keyPair.privateKey) {
    throw new Error('Cannot verify without keys.')
  }
  let publicKey = keyPair.publicKey
  if (!publicKey) {
    publicKey = await publicKeyCreate(keyPair.privateKey, true)
  }
  const verified = Verify(msg, signature, publicKey)
  return verified
}
