// @flow
import hashjs from 'hash.js'

export const digest = (alg: string, data: Buffer, func: Function) => {
  const hash = hashjs[alg]
  if (!hash) throw new Error('Unknown algorithm.')
  const digest = func(hash)
    .update(data)
    .digest()
  return Buffer.from(digest)
}

export const hash = (alg: string, data: Buffer) =>
  digest(alg, data, hash => hash())
export const hmac = (alg: string, data: Buffer, key: Buffer) =>
  digest(alg, data, hash => hashjs.hmac(hash, key))

export const sha256 = (data: Buffer) => hash('sha256', data)
export const ripemd160 = (data: Buffer) => hash('ripemd160', data)

export const hash256 = (data: Buffer) => sha256(sha256(data))
export const hash160 = (data: Buffer) => ripemd160(sha256(data))

export {
  publicKeyCreate,
  privateKeyTweakAdd,
  publicKeyTweakAdd,
  sign,
  verify
} from 'secp256k1'
