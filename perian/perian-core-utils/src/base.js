// @flow

import { Buffer } from 'buffer'

import basex from 'base-x'

import { hash256 } from './crypto/hash.js'
import type { Alphabet, BaseDecoder, Bases, HashFunction } from './types.js'

// The default ALPHABETS, the name of the base codec will be the alphabet's length
export const ALPHABETS: Array<Alphabet> = [
  '01',
  '01234567',
  '0123456789a',
  '0123456789abcdef',
  '0123456789ABCDEFGHJKMNPQRSTVWXYZ',
  '0123456789abcdefghijklmnopqrstuvwxyz',
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
]

export const createCheckSumBase = (
  base: BaseDecoder,
  hashFunc?: HashFunction<string>
): BaseDecoder => ({
  encode: (hexStr: string): string => {
    const checksum = (hashFunc || hash256)(hexStr)
    const checkHex = `${hexStr}${checksum.slice(0, 8)}`
    return base.encode(checkHex)
  },
  decode: (baseString: string): string => {
    const hexStr = base.decode(baseString)
    const payload = hexStr.slice(0, -8)
    const newChecksum = (hashFunc || hash256)(payload)
    const checksum = hexStr.slice(-8)
    if (newChecksum.startsWith(checksum)) return payload
    throw new Error('Invalid checksum')
  }
})

export const createHexEncoder = (
  base: BaseDecoder,
  hashFunc?: HashFunction<string>
): BaseDecoder => {
  const newBase = { ...base }
  const encode: (buf: Buffer) => string = newBase.encode
  const decode: (str: string) => Buffer = newBase.decode
  newBase.encode = a => encode(Buffer.from(a, 'hex'))
  newBase.decode = a => decode(a).toString('hex')
  return { ...newBase, check: createCheckSumBase(newBase, hashFunc) }
}

export const base: Bases = ALPHABETS.reduce((decoders, alphabet) => {
  const baseDecoder = createHexEncoder(basex(alphabet))
  return { ...decoders, [alphabet.length]: baseDecoder }
}, {})
