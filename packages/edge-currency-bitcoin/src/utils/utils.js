/**
 * Created by paul on 8/26/17.
 * @flow
 */

import { type Disklet } from 'disklet'
import { validate } from 'jsonschema'
import { Utils } from 'nidavellir'

const SAVE_DATASTORE_MILLISECONDS = 10000

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

export const cache = async (
  folder: Disklet,
  fileName: string,
  id: string
): Object => {
  const save = async (data: Object) => {
    if (!fileName) return
    try {
      await folder.setText(fileName, JSON.stringify(data))
      console.log(`${id} - Saved ${fileName}`)
    } catch (e) {
      console.log(`${id} - Error when saving ${fileName} - ${e.toString()}`)
    }
  }
  const load = async (): Promise<Object> => {
    if (!fileName) return {}
    try {
      const data: string = await folder.getText(fileName)
      const json = JSON.parse(data)
      return json
    } catch (e) {
      console.log(`${id} - Error when loading ${fileName} - ${e.toString()}`)
      return {}
    }
  }

  const proxy = Utils.Persister.persist(save, load, SAVE_DATASTORE_MILLISECONDS)
  await proxy()
  return proxy
}
