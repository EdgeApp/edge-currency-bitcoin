// @flow

import { Crypto } from '@perian/core-utils'

import type { KeyPair } from '../../types/keyPair.js'

export const fromHex = (keyHex: string): KeyPair<string> => {
  if (keyHex.length !== 66 && keyHex.length !== 132) {
    throw new Error('Wrong key pair length')
  }
  const firstHeaderByte = parseInt(keyHex.slice(0, 2), 16)
  try {
    if (firstHeaderByte !== 0) throw new Error('Bad Private key prefix')
    const keyPair: KeyPair<string> = { privateKey: keyHex.slice(2, 66) }
    if (keyHex.length === 132) {
      const secondHeaderByte = parseInt(keyHex.slice(66, 68), 16)
      if (secondHeaderByte !== 2 && secondHeaderByte !== 3) {
        throw new Error('Bad Public key prefix')
      }
      const pub = { publicKey: keyHex.slice(68, 132) }
      Object.assign(keyPair, pub)
    }
    return keyPair
  } catch (e) {
    if (firstHeaderByte !== 2 && firstHeaderByte !== 3) {
      throw new Error('Bad Public key prefix')
    }
    return { publicKey: keyHex.slice(0, 66) }
  }
}

export const toHex = (keyPair: KeyPair<string>): string => {
  const publicKey = keyPair.publicKey || ''
  const privateKey = keyPair.privateKey ? `00${keyPair.privateKey}` : ''

  return `${privateKey}${publicKey}`
}

export const sign = async (
  keyPair: KeyPair<string>,
  msg: string
): Promise<string> => {
  if (!keyPair.privateKey) throw new Error('Cannot sign without private key.')
  return Crypto.sign(msg, keyPair.privateKey)
}

export const verify = async (
  keyPair: KeyPair<string>,
  msg: string,
  signature: string
): Promise<Boolean> => {
  let publicKey = keyPair.publicKey
  if (!publicKey && keyPair.privateKey) {
    publicKey = await Crypto.publicKeyCreate(keyPair.privateKey, true)
  } else {
    throw new Error('Cannot verify without keys.')
  }
  const verified = await Crypto.verify(msg, signature, publicKey)
  return verified
}
