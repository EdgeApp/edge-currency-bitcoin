import type { ExtendedKeyPair } from '../../types/extendedKeys.js'
// @flow
import type { HDKey, HDPath, Path } from '../../types/hd.js'
import { HARDENED } from '../bip32/derive.js'
import * as ExtendedKey from '../bip32/extendedKey.js'

export const fromSeed = async (
  seed: string,
  network?: string
): Promise<HDKey> => {
  const masterKeyPair = await ExtendedKey.fromSeed(seed, network)
  return {
    ...masterKeyPair,
    hardened: false,
    path: ['m'],
    children: {}
  }
}

export const fromString = async (
  extendedKey: string,
  hdPath?: HDPath,
  network?: string
): Promise<HDKey> => {
  const keyPair: ExtendedKeyPair = await ExtendedKey.fromString(
    extendedKey,
    network
  )
  return fromExtendedKey(keyPair, hdPath)
}

export const toString = ExtendedKey.toString

export const fromExtendedKey = (
  keyPair: ExtendedKeyPair,
  hdPath?: HDPath
): HDKey => {
  const hardened = keyPair.childIndex >= HARDENED
  const { path = [] } = hdPath || {}
  let indexStr = 'm'

  if (keyPair.depth) {
    const index = keyPair.childIndex
    const adjIndex = hardened ? index - HARDENED : index
    indexStr = `${adjIndex}${hardened ? "'" : ''}`
  }

  if (path[0] !== 'm') path.unshift('m')
  if (path.length === keyPair.depth) {
    path.push(indexStr)
  }
  if (path.length !== keyPair.depth + 1) {
    throw new Error('Wrong path depth for key')
  }
  if (path[path.length - 1] !== indexStr) {
    throw new Error('Wrong index for key')
  }

  return {
    ...keyPair,
    ...hdPath,
    path,
    hardened,
    children: {}
  }
}

export const fromParent = async (
  parentKeys: HDKey,
  hdPath: HDPath = { path: [] },
  network?: string
): Promise<HDKey> => {
  const parentPath = parentKeys.path
  const relativePath = hdPath.path.slice(parentPath.length)
  if (!relativePath.length) return parentKeys

  const { path, parentKey } = getParentKey(parentKeys, relativePath)

  let childHDKey = parentKey

  while (path.length) {
    const index = path.shift()
    const childKey = await ExtendedKey.fromParent(childHDKey, index, network)
    const newChildHDKey = fromExtendedKey(childKey, {
      ...parentKeys,
      ...hdPath
    })

    childHDKey.children[index] = newChildHDKey
    childHDKey = newChildHDKey
  }

  return parentKeys
}

export const getParentKey = (
  parentKey: HDKey,
  path: Path
): { parentKey: HDKey, path: Path } => {
  while (parentKey.children[path[0]] && path.length) {
    parentKey = parentKey.children[path.shift()]
  }
  return { parentKey, path }
}

export const getHDKey = (parentKey: HDKey, path: Path): HDKey | null => {
  while (parentKey && path.length) {
    parentKey = parentKey.children[path.shift()]
  }
  return parentKey
}
