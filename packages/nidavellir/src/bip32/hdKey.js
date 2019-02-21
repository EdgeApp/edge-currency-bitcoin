// @flow

import type {
  ExtendedKeyPair,
  HDKeyPair,
  HDPath,
  Index,
  Path
} from '../../types/bip32.js'
import { HARDENED } from '../bip32/derive.js'
import * as ExtendedKey from '../bip32/extendedKey.js'

export const fromSeed = async (
  seed: string,
  network?: string
): Promise<HDKeyPair> => {
  const masterKeyPair = await ExtendedKey.fromSeed(seed, network)
  return {
    ...masterKeyPair,
    hardened: false,
    path: ['m'],
    children: {}
  }
}

export const fromExtendedKey = (
  keyPair: ExtendedKeyPair,
  hdPath?: HDPath
): HDKeyPair => {
  const hardened = keyPair.childIndex >= HARDENED
  const { path: parentPath = [] } = hdPath || {}
  let indexStr = 'm'

  const path = [...parentPath]
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

  const hdKey: HDKeyPair = { ...keyPair, path, hardened, children: {} }
  const { scriptType, chain } = hdPath || {}
  if (scriptType) hdKey.scriptType = scriptType
  if (chain) hdKey.chain = chain

  return hdKey
}

export const fromIndex = async (
  parentKey: HDKeyPair,
  index: Index,
  network?: string
): Promise<HDKeyPair> => {
  // Derive an ExtendedKey key from the current parentKey and index
  const childKey = await ExtendedKey.fromIndex(parentKey, index, network)
  const childHDPath = {
    ...parentKey,
    path: [...parentKey.path, index]
  }
  // Create an HD key from the ExtendedKey
  return fromExtendedKey(childKey, childHDPath)
}

export const fromPath = async (
  parentKeys: HDKeyPair,
  hdPath: HDPath,
  network?: string
): Promise<HDKeyPair> => {
  // Get the deepest possible parent for this key
  const parent = getParentKey(parentKeys, hdPath.path)
  // Set the starting derivation key to be the parent key from before
  let childHDKey = parent.key

  while (parent.path.length) {
    // Get next child key
    const index = parent.path.shift()
    const childKey = await fromIndex(childHDKey, index, network)

    // Add the new key to the current parent key and change the pointer
    childHDKey.children[index] = childKey
    childHDKey = childKey
  }

  // Set the scriptType and chain for the deepest path
  childHDKey.scriptType = hdPath.scriptType || 'P2PKH'
  childHDKey.chain = hdPath.chain || 'external'

  return parentKeys
}

export const fromPaths = async (
  parentKey: HDKeyPair | string,
  hdPaths: Array<HDPath>,
  network?: string
): Promise<HDKeyPair> => {
  // If we get a seed create a master hd key from it
  if (typeof parentKey === 'string') {
    parentKey = await fromSeed(parentKey, network)
  }

  // Create All missing key paths
  for (const hdPath of hdPaths) {
    parentKey = await fromPath(parentKey, hdPath)
  }

  return parentKey
}

export const fromString = (
  extendedKey: string,
  hdPath?: HDPath,
  network?: string
): HDKeyPair => {
  const keyPair: ExtendedKeyPair = ExtendedKey.fromString(extendedKey, network)
  return fromExtendedKey(keyPair, hdPath)
}

export const getParentKey = (
  parentKey: HDKeyPair,
  path: Path
): { key: HDKeyPair, path: Path } => {
  const tempPath = [...path]
  tempPath.shift()
  while (parentKey.children[tempPath[0]] && tempPath.length) {
    parentKey = parentKey.children[tempPath.shift()]
  }
  return { key: parentKey, path: tempPath }
}

export const getKey = (parentKey: HDKeyPair, path: Path): HDKeyPair | null => {
  const tempPath = [...path]
  tempPath.shift()
  while (parentKey && tempPath.length) {
    parentKey = parentKey.children[tempPath.shift()]
  }
  return parentKey
}

export const createPath = (
  account: number = 0,
  parent: HDPath = { path: ['m'] },
  hardened?: boolean
): HDPath => {
  const { chain = 'external', scriptType = 'P2PKH' } = parent

  const accountStr = `${account}${hardened ? "'" : ''}`
  const index = chain === 'external' ? '0' : '1'
  const path = [...parent.path, accountStr, index]

  return { path, chain, scriptType }
}

export const toString = ExtendedKey.toString
