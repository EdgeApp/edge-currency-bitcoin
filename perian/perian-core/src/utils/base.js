import basex from 'base-x'

// @flow
import type { Alphabet, Base, Bases, HashFunction } from '../../types/base.js'
import { hash256 } from './crypto.js'

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
  base: Base,
  hashFunc: HashFunction
): Base => ({
  encode: async (hexStr: string): Promise<string> => {
    const checksum = await hashFunc(hexStr)
    const checkHex = `${hexStr}${checksum.slice(0, 8)}`
    return base.encode(checkHex)
  },
  decode: async (baseString: string): Promise<string> => {
    const hexStr = await base.decode(baseString)
    const payload = hexStr.slice(0, -8)
    const newChecksum = await hashFunc(payload)
    const checksum = hexStr.slice(-8)
    if (newChecksum.startsWith(checksum)) return payload
    throw new Error('Invalid checksum')
  }
})

export const base: Bases = ALPHABETS.reduce((decoders, alphabet) => {
  const baseDecoder = basex(alphabet)
  const encode = baseDecoder.encode
  const decode = baseDecoder.decode
  baseDecoder.encode = a => encode(Buffer.from(a, 'hex'))
  baseDecoder.decode = a =>
    Promise.resolve(decode(a)).then(res => res.toString('hex'))
  baseDecoder.check = createCheckSumBase(baseDecoder, hash256)
  return { ...decoders, [alphabet.length]: baseDecoder }
}, {})
