// @flow

import type { ExtendedKeyPair } from '../../types/extendedKeys.js'
import type {
  HDKey,
  HDPath,
  HDSettings,
  HDStandardPathParams,
  Path
} from '../../types/hd.js'
import { HARDENED } from '../bip32/derive.js'
import * as ExtendedKey from '../bip32/extendedKey.js'
import { networks } from '../commons/network.js'
import { defaultSettings, fromSettings } from './paths.js'

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

export const fromString = (
  extendedKey: string,
  hdPath?: HDPath,
  network?: string
): HDKey => {
  const keyPair: ExtendedKeyPair = ExtendedKey.fromString(extendedKey, network)
  return fromExtendedKey(keyPair, hdPath)
}

export const toString = ExtendedKey.toString

export const fromExtendedKey = (
  keyPair: ExtendedKeyPair,
  hdPath?: HDPath
): HDKey => {
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

  const hdKey: HDKey = { ...keyPair, path, hardened, children: {} }
  const { scriptType, chain } = hdPath || {}
  if (scriptType) hdKey.scriptType = scriptType
  if (chain) hdKey.chain = chain

  return hdKey
}

export const fromParent = async (
  parentKeys: HDKey,
  hdPath: HDPath,
  network?: string
): Promise<HDKey> => {
  // Get the deepest possible parent for this key
  const parent = getParentKey(parentKeys, hdPath.path)
  // Set the starting derivation key to be the parent key from before
  const pathLeft = [...parent.path]
  let childHDKey = parent.key
  const childPath = [...childHDKey.path]

  while (pathLeft.length) {
    // Get next child key
    const index = pathLeft.shift()
    const childKey = await ExtendedKey.fromParent(childHDKey, index, network)
    childPath.push(index)
    // Create an HD key from the current childKey and path
    const { scriptType, chain } = childHDKey
    const childHDPath = { ...hdPath, path: [...childPath] }
    if (!childHDPath.scriptType && scriptType) {
      childHDPath.scriptType = scriptType
    }
    if (!childHDPath.chain && chain) {
      childHDPath.chain = chain
    }
    const newChildHDKey = fromExtendedKey(childKey, childHDPath)
    // Add the new key to the current parent key and change the pointer
    childHDKey.children[index] = newChildHDKey
    childHDKey = newChildHDKey
  }

  return parentKeys
}

export const fromHDSettings = async (
  parentKey: HDKey,
  network?: string,
  pathParams?: HDStandardPathParams,
  hdSettings: HDSettings = defaultSettings
): Promise<HDKey> => {
  // Create an array of all of the required derivation path settings
  if (network) hdSettings = networks[network].hdSettings
  const hdPaths = fromSettings(hdSettings, pathParams, parentKey)
  return fromHDPaths(parentKey, hdPaths, network)
}

export const fromHDPaths = async (
  parentKey: HDKey,
  hdPaths: Array<HDPath>,
  network?: string
): Promise<HDKey> => {
  // If we get a seed create a master hd key from it
  if (typeof parentKey === 'string') {
    parentKey = await fromSeed(parentKey, network)
  }

  // Create All missing key paths
  for (const hdPath of hdPaths) {
    parentKey = await fromParent(parentKey, hdPath)
  }

  return parentKey
}

export const getParentKey = (
  parentKey: HDKey,
  path: Path
): { key: HDKey, path: Path } => {
  const tempPath = [...path]
  tempPath.shift()
  while (parentKey.children[tempPath[0]] && tempPath.length) {
    parentKey = parentKey.children[tempPath.shift()]
  }
  return { key: parentKey, path: tempPath }
}

export const getHDKey = (parentKey: HDKey, path: Path): HDKey | null => {
  const tempPath = [...path]
  tempPath.shift()
  while (parentKey && tempPath.length) {
    parentKey = parentKey.children[tempPath.shift()]
  }
  return parentKey
}
