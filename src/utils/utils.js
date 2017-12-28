/**
 * Created by paul on 8/26/17.
 * @flow
 */

import { validate } from 'jsonschema'
import crypto from 'crypto'

export function validateObject (object: any, schema: any) {
  let result = null
  try {
    result = validate(object, schema)
  } catch (e) {
    console.error(e)
    return false
  }

  return result && result.errors && result.errors.length === 0
}

export async function hash256 (hex: any) {
  return Promise.resolve(hash256(hex))
}

export function hash256Sync (hex: any) {
  return crypto
    .createHash('sha256')
    .update(hex)
    .digest()
}

export async function hash160 (hex: any) {
  return Promise.resolve(
    crypto
      .createHash('ripemd160')
      .update(await hash256(hex))
      .digest()
  )
}

export function reverseBufferToHex (rawBuffer: any) {
  return rawBuffer
    .toString('hex')
    .match(/../g)
    .reverse()
    .join('')
}
