// @flow

import { hd } from 'bcoin'
import { getPrivateFromSeed } from './key.js'
import keyMap from './keyMap.js'
import type {
  Base58Key,
  Base58KeyPair,
  BcoinHDKeyPair,
  HDKey,
  HDKeyType,
  HDMasterKey,
  HDSettings
} from './types.js'

export const fromBase58 = (base58Key: Base58Key, network: string): HDKey =>
  keyMap(
    base58Key,
    ({ priv, pub }: Base58KeyPair): BcoinHDKeyPair => ({
      priv: priv ? hd.PrivateKey.fromBase58(priv, network) : null,
      pub: hd.PublicKey.fromBase58(pub, network)
    })
  )

export const toBase58 = (key: HDKey, network: string): Base58Key =>
  keyMap(
    key,
    ({ priv, pub }: BcoinHDKeyPair): Base58KeyPair => ({
      priv: priv ? priv.toBase58(network) : '',
      pub: pub.toBase58(network)
    })
  )

export const getKeyForPath = (
  hdKey: HDKey,
  path: string,
  createNew?: boolean = false
): HDKey | null => {
  const { path: parentPath, children } = hdKey
  if (path === parentPath) return hdKey

  let newKey = null

  for (const childPath in children) {
    const childKey = children[childPath]
    if (!path.startsWith(childKey.path)) continue
    newKey = getKeyForPath(childKey, path, createNew)
    if (newKey) break
  }

  if (createNew && !newKey) {
    const relativePath = path.replace(`${parentPath}/`, '')
    newKey = {
      scriptType: hdKey.scriptType,
      path,
      children: {},
      keyType: 'publicKey'
    }
    hdKey.children[relativePath] = newKey
  }
  return newKey
}

export const createKeyPath = (hdKey: HDKey, path: string): HDKey =>
  getKeyForPath(hdKey, path, true) || hdKey

export const fromHDSettings = (
  parentKey: HDKey,
  hdSettings: HDSettings,
  account: number,
  coinType: number
): HDKey => {
  if (!parentKey) parentKey = { path: 'm', children: {}, keyType: 'privateKey' }
  for (const branchPath in hdSettings) {
    const branchSettings = hdSettings[branchPath]
    const { getPath, children = {}, keyType } = branchSettings
    const relativePath = getPath ? getPath(account, coinType) : branchPath
    const path = `${parentKey.path}/${relativePath}`
    const oldHDKey = parentKey.children[relativePath]
    const scriptType = parentKey.scriptType || branchSettings.scriptType
    const newChildKey = {
      path,
      children: {},
      keyType,
      scriptType,
      ...oldHDKey
    }
    parentKey.children[relativePath] = fromHDSettings(
      newChildKey,
      children,
      account,
      coinType
    )
  }
  return parentKey
}

export const keyPair = async (
  parentKeyPair: BcoinHDKeyPair,
  childPath: string,
  keyType: HDKeyType
): Promise<BcoinHDKeyPair | void> => {
  const bcoinPath = childPath[0] === 'm' ? childPath : `m/${childPath}`
  const { priv: parentPriv, pub: parentPub } = parentKeyPair
  if (parentPriv) {
    const privateKey = await parentPriv.derivePath(bcoinPath)
    const pub = await privateKey.toPublic()
    const priv = keyType === 'privateKey' ? privateKey : null
    return { priv, pub }
  } else if (keyType === 'publicKey' && parentPub) {
    const pub = await parentPub.derivePath(bcoinPath)
    return { pub }
  }
}

export const initHDKey = async (
  hdKey: HDKey,
  network: string,
  seed?: string,
  xpub?: string,
  parentHDKey?: HDKey
): Promise<HDMasterKey> => {
  const { keyType, path, key = {} } = hdKey
  // If it's the masterKey, try and use the seed
  if (!key.priv && path === 'm' && seed) {
    const priv = await getPrivateFromSeed(seed, network)
    const pub = await priv.toPublic()
    Object.assign(key, { priv, pub })
  }
  // If it's the masterKey, try and use the seed
  if (!key.pub && keyType === 'publicKey' && xpub) {
    Object.assign(key, { pub: hd.PublicKey.fromBase58(xpub, network) })
  }
  // Try and derive the key using it's parent
  if (parentHDKey && (!key.priv || !key.pub)) {
    const relativeKeyPath = path.replace(`${parentHDKey.path}/`, '')
    const newKeyPair =
      parentHDKey.key &&
      (await keyPair(parentHDKey.key, relativeKeyPath, keyType))
    if (newKeyPair) Object.assign(key, newKeyPair)
  }
  // Create the returned Key
  const masterHDkey: HDMasterKey = { ...hdKey, key, children: {} }
  // Init the HDKey children and append them to the returned masterHDkey
  for (const childPath in hdKey.children) {
    const childKey = hdKey.children[childPath]
    if (childKey.keyType === 'address') {
      masterHDkey.children[childPath] = childKey
    } else {
      masterHDkey.children[childPath] = await initHDKey(
        childKey,
        network,
        seed,
        key.pub.xpubkey(),
        masterHDkey
      )
    }
  }

  return masterHDkey
}
