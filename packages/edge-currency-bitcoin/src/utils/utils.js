/**
 * Created by paul on 8/26/17.
 * @flow
 */

import { type Disklet } from 'disklet'
import { validate } from 'jsonschema'

import { getLock } from './bcoinUtils/misc.js'

export const base64regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

export function validateObject (object: any, schema: any) {
  let result = null
  try {
    result = validate(object, schema)
  } catch (e) {
    console.log(e)
    return false
  }

  return result && result.errors && result.errors.length === 0
}

export const hexToVarByte = (hex: string) => {
  const len = hex.length / 2
  const str = len.toString(16)
  const hexLen = str.length % 2 === 0 ? str : `0${str}`
  return hexLen + hex
}

export const reverseHexString = (hexString: string) =>
  (hexString.match(/../g) || []).reverse().join('')

/**
 * Waits for the first successful promise.
 * If no promise succeeds, returns the last failure.
 */
export function promiseAny (promises: Array<Promise<any>>): Promise<any> {
  return new Promise((resolve: Function, reject: Function) => {
    let pending = promises.length
    for (const promise of promises) {
      promise.then(value => resolve(value), error => --pending || reject(error))
    }
  })
}

export function saveCache (folder: Disklet, id: string) {
  const saveCacheLock = getLock()
  return async (fileName: string, data: Object, cacheDirty: boolean = true) => {
    const unlock = await saveCacheLock.lock()
    try {
      if (cacheDirty) {
        if (!fileName || fileName === '') {
          throw new Error(`Missing File ${fileName}`)
        }
        const jsonString = JSON.stringify(data)
        await folder.setText(fileName, jsonString)
        console.log(`${id} - Saved ${fileName}`)
        cacheDirty = false
      }
    } catch (e) {
      console.log(`${id} - Error when saving ${fileName} - ${e.toString()}`)
    } finally {
      unlock()
    }
    return cacheDirty
  }
}
