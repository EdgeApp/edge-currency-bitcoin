/**
 * Created by paul on 8/26/17.
 * @flow
 */

import { type Disklet } from 'disklet'
import { validate } from 'jsonschema'
import { Utils } from 'nidavellir'

import { logger } from '../utils/logger.js'

const SAVE_DATASTORE_MILLISECONDS = 10000

export const envSettings = {
  fileVersion: 1,
  fileNames: {
    txs: 'txs.json',
    txHeights: 'txHeights.json',
    addresses: 'addresses.json',
    keys: 'hdKey.json',
    headers: 'headers.json',
    servers: 'servers.json',
    height: 'height.json'
  },
  gapLimit: 10,
  imageServer: 'https://developer.airbitz.co/content',
  infoServer: 'https://info1.edgesecure.co:8444/v1'
}

export const base64regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

export function validateObject (object: any, schema: any) {
  let result = null
  try {
    result = validate(object, schema)
  } catch (e) {
    logger.info(e)
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

export const createCachePath = (
  fileName: string,
  version: number = envSettings.fileVersion
): string => {
  const folderName = `v${version}`
  const filePath = `${folderName}/${fileName}`
  return filePath
}

export const cache = async (
  folder: Disklet,
  file: string | Array<string>,
  id: string
): Object => {
  if (Array.isArray(file)) {
    const caches = {}
    for (const fileType of file) {
      const fileCache = await cache(folder, fileType, id)
      caches[fileType] = fileCache
    }
    return caches
  }
  const fileName = envSettings.fileNames[file]
  const filePath = createCachePath(fileName)

  const save = async (data: Object) => {
    if (!fileName) return
    try {
      await folder.setText(filePath, JSON.stringify(data))
      logger.info(`${id} - Saved ${filePath}`)
    } catch (e) {
      logger.info(`${id} - Error when saving ${filePath} - ${e.toString()}`)
    }
  }
  const load = async (): Promise<Object> => {
    if (!fileName) return {}
    try {
      const data: string = await folder.getText(filePath)
      const json = JSON.parse(data)
      return json
    } catch (e) {
      for (let i = envSettings.fileVersion - 1; i > 0; i--) {
        const legacyPath = createCachePath(fileName, i)
        await folder.delete(legacyPath)
      }
      await folder.delete(fileName)
      logger.info(`${id} - Error when loading ${filePath} - ${e.toString()}`)
      return {}
    }
  }

  const proxy = Utils.Persister.persist(save, load, SAVE_DATASTORE_MILLISECONDS)
  await proxy()
  return proxy
}
