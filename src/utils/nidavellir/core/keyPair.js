// @flow

import { type HexPair } from '../types/core.js'
import {
  publicKeyCreate,
  sign as Sign,
  verify as Verify
} from '../utils/secp256k1.js'
import { networks } from './networkInfo.js'

export const fromHex = (keyHex: string): HexPair => {
  if (keyHex.length !== 66 && keyHex.length !== 132) {
    throw new Error('Wrong key pair length')
  }
  const firstHeaderByte = parseInt(keyHex.slice(0, 2), 16)
  try {
    if (firstHeaderByte !== 0) throw new Error('Bad Private key prefix')
    const keyPair: HexPair = { privateKey: keyHex.slice(2, 66) }
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

export const privateFromWIF = (
  wif: string,
  network: string = 'main'
): { privateKey: string, compress: boolean } => {
  const { serializers, keyPrefix } = networks[network]
  const keyHex = serializers.wif.decode(wif)
  if (parseInt(keyHex.slice(0, 2), 16) !== keyPrefix.privkey) {
    throw new Error(
      `Unknown key prefix ${keyHex.slice(0, 2)} for network ${network}`
    )
  }
  const privateKey = keyHex.slice(2, 66)
  let compress = false
  if (keyHex.length >= 68) {
    if (parseInt(keyHex.slice(66, 68), 16) !== 1) {
      throw new Error(`Unknown compression flag ${keyHex.slice(66, 68)}`)
    }
    compress = true
  }
  return { privateKey, compress }
}

export const fromWif = async (
  wif: string,
  network: string = 'main'
): Promise<HexPair> => {
  const { privateKey, compress } = privateFromWIF(wif, network)
  const publicKey = await publicKeyCreate(privateKey, compress)
  return { privateKey, publicKey }
}

export const toHex = (keyPair: HexPair): string => {
  const publicKey = keyPair.publicKey || ''
  const privateKey = keyPair.privateKey ? `00${keyPair.privateKey}` : ''
  return `${privateKey}${publicKey}`
}

export const sign = async (keyPair: HexPair, msg: string): Promise<string> => {
  if (!keyPair.privateKey) throw new Error('Cannot sign without private key.')
  return Sign(msg, keyPair.privateKey)
}

export const verify = async (
  keyPair: HexPair,
  msg: string,
  signature: string
): Promise<Boolean> => {
  let publicKey = keyPair.publicKey
  if (!publicKey && keyPair.privateKey) {
    publicKey = await publicKeyCreate(keyPair.privateKey, true)
  } else {
    throw new Error('Cannot verify without keys.')
  }
  const verified = await Verify(msg, signature, publicKey)
  return verified
}
