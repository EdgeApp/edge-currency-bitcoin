// @flow

import * as API from '../../types/publicAPI.js'
import { networks } from './networkInfo.js'
import {
  publicKeyCreate,
  sign as Sign,
  verify as Verify
} from '../../src/utils/secp256k1.js'

export const fromWIF: API.FromWIF = (wif, network = 'main') => {
  const { prefixHex, decoder } = networks[network].wif
  const keyHex = decoder.decode(wif)
  if (parseInt(keyHex.slice(0, 2), 16) !== prefixHex) {
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

export const toWIF: API.ToWIF = (privateKey, network = 'main', compress = true) => {
  if (privateKey.length !== 64) throw new Error(`Wrong key length`)
  const { prefixHex, decoder } = networks[network].wif
  const prefix = prefixHex.toString(16)
  const compressFlag = compress ? '01' : ''
  const hexKey = `${prefix}${privateKey}${compressFlag}`
  return decoder.encode(hexKey)
}

export const toPublic: API.ToPublic = async (privateKey, compress = true) => publicKeyCreate(privateKey, compress)

export const toSignature: API.ToSignature = async (privateKey, msg) => Sign(msg, privateKey)

export const verify = async (
  msg: string,
  signature: string,
  publicKey?: string,
  privateKey?: string
): Promise<Boolean> => {
  if (!publicKey) {
    if (!privateKey) throw new Error('Cannot verify without keys.')
    publicKey = await publicKeyCreate(privateKey, true)
  }
  const verified = await Verify(msg, signature, publicKey)
  return verified
}
