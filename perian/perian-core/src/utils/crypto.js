// @flow
import hashjs from 'hash.js'
import {
  privateKeyTweakAdd as PrivateKeyTweakAdd,
  publicKeyCreate as PublicKeyCreate,
  publicKeyTweakAdd as PublicKeyTweakAdd,
  sign as Sign,
  verify as Verify
} from 'secp256k1'

export const digest = (alg: string, data: string, func: Function) => {
  const dataBuffer = Buffer.from(data, 'hex')
  const hash = hashjs[alg]
  if (!hash) throw new Error('Unknown algorithm.')
  const digest = func(hash)
    .update(dataBuffer)
    .digest()
  return Buffer.from(digest)
}

export const hash = (alg: string, data: string): string =>
  digest(alg, data, hash => hash()).toString('hex')
export const hmac = (alg: string, data: string, key: string): string =>
  digest(alg, data, hash =>
    hashjs.hmac(hash, Buffer.from(key, 'hex'))
  ).toString('hex')

export const sha256 = (data: string) => hash('sha256', data)
export const ripemd160 = (data: string) => hash('ripemd160', data)

export const hash256 = (data: string) => sha256(sha256(data))
export const hash160 = (data: string) => ripemd160(sha256(data))

export const publicKeyCreate = async (
  privateKey: string,
  compressed?: boolean
): Promise<string> => {
  const res = await PublicKeyCreate(Buffer.from(privateKey, 'hex'), compressed)
  return res.toString('hex')
}
export const privateKeyTweakAdd = async (
  privateKey: string,
  tweak: string
): Promise<string> => {
  const res = await PrivateKeyTweakAdd(
    Buffer.from(privateKey, 'hex'),
    Buffer.from(tweak, 'hex')
  )
  return res.toString('hex')
}

export const publicKeyTweakAdd = async (
  publicKey: string,
  tweak: string,
  compressed?: boolean
): Promise<string> => {
  const res = await PublicKeyTweakAdd(
    Buffer.from(publicKey, 'hex'),
    Buffer.from(tweak, 'hex'),
    compressed
  )
  return res.toString('hex')
}

export const sign = async (
  message: string,
  privateKey: string,
  options?: any
): Promise<string> => {
  const res = await Sign(
    Buffer.from(message, 'hex'),
    Buffer.from(privateKey, 'hex'),
    options
  )
  return res.toString('hex')
}

export const verify = async (
  message: string,
  signature: string,
  publicKey: string
): Promise<string> => {
  const res = await Verify(
    Buffer.from(message, 'hex'),
    Buffer.from(signature, 'hex'),
    Buffer.from(publicKey, 'hex')
  )
  return res.toString('hex')
}
