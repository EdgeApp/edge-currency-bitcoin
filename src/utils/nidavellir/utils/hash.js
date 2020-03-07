// @flow

import { type Hashes } from '../../types/utils.js'
import { lazify } from './require.js'
import { fromUint8Array, toUint8Array } from './uintArray.js'

export const hashjs: Hashes<Uint8Array> = (lazify(() =>
  require('hash.js')
): any)

export const digest = (hash: Function) => (data: string) => {
  const uintArray = toUint8Array(data)
  const rawRes = hash()
    .update(uintArray)
    .digest()
  const resArray = new Uint8Array(rawRes)
  return fromUint8Array(resArray)
}

export const digestHmac = (hmac: Function, hash: Function) => (
  data: string,
  key: string
) => {
  const uintKey = toUint8Array(key)
  const hmacHash = () => hmac(hash, uintKey)
  return digest(hmacHash)(data)
}

export const sha256 = digest(hashjs.sha256)
export const sha512 = digest(hashjs.sha512)
export const ripemd160 = digest(hashjs.ripemd160)
export const sha512Hmac = digestHmac(hashjs.hmac, hashjs.sha512)

export const hash256 = (data: string) => sha256(sha256(data))
export const hash160 = (data: string) => ripemd160(sha256(data))
