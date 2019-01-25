// @flow
import type { Base, Bases, Alphabet, HashFunction } from './types.js'
import { hash256 } from './crypto.js'
import basex from 'base-x'

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
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~'
]

export const createCheckSumBase = (
  base: Base,
  hashFunc: HashFunction
): Base => ({
  encode: async (buf: Buffer): Promise<string> => {
    const checksum = await hashFunc(buf)
    const checkBuf = Buffer.concat([buf, checksum], buf.length + 4)
    return base.encode(checkBuf)
  },
  decode: async (baseString: string): Promise<Buffer> => {
    const buffer = await base.decode(baseString)
    const payload = buffer.slice(0, -4)
    const newChecksum = await hashFunc(payload)
    const checksum = buffer.slice(-4)

    if (
      checksum[0] === newChecksum[0] &&
      checksum[1] === newChecksum[1] &&
      checksum[2] === newChecksum[2] &&
      checksum[3] === newChecksum[3]
    ) {
      return payload
    }

    throw new Error('Invalid checksum')
  }
})

export const base: Bases = ALPHABETS.reduce((decoders, alphabet) => {
  const baseDecoder = basex(alphabet)
  baseDecoder.check = createCheckSumBase(baseDecoder, hash256)
  return { ...decoders, [alphabet.length]: baseDecoder }
}, {})
