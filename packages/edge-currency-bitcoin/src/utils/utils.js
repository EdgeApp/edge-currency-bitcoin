/**
 * Created by paul on 8/26/17.
 * @flow
 */

import { getLock } from './bcoinUtils/misc.js'
import { validate } from 'jsonschema'
import type { DiskletFolder } from 'disklet'

export const base64regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

export const isEmptyObject = (value: Object) => {
  for (const key in value) {
    if (hasOwnProperty.call(value, key)) {
      return false
    }
  }
  return true
}

export type SaveCache = (
  fileName: string,
  cacheDirty: boolean,
  cacheName: string,
  data: Object
) => Promise<boolean>

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

export function saveCache (folder: DiskletFolder, id: string) {
  const saveCacheLock = getLock()
  return async (
    fileName: string,
    cacheDirty: boolean,
    cacheName: string,
    data: Object
  ) => {
    const unlock = await saveCacheLock.lock()
    try {
      if (cacheDirty) {
        if (!fileName || fileName === '') {
          throw new Error(`Missing ${cacheName}File`)
        }
        const jsonString = JSON.stringify(data)
        await folder.file(fileName).setText(jsonString)
        console.log(`${id} - Saved ${cacheName} cache`)
        cacheDirty = false
      }
    } catch (e) {
      const name = cacheName.charAt(0).toUpperCase() + cacheName.slice(1)
      console.log(`${id} - save${name}Cache - ${e.toString()}`)
    } finally {
      unlock()
    }
    return cacheDirty
  }
}
