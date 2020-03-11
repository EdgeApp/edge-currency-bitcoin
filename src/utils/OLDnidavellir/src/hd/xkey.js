// @flow

import * as API from '../../types/publicAPI.js'
import { type ExtendedKey } from '../../types/hd.js'
import { getHDSetting } from '../core/networkInfo.js'
import * as XPriv from './xpriv.js'
import * as XPub from './xpub.js'

export const fromHex: API.FromHex<ExtendedKey> = (keyHex, network) => {
  const headerByte = parseInt(keyHex.slice(90, 92), 16)
  if (headerByte === 0) return XPriv.fromHex(keyHex, network)
  else if (headerByte === 2 && headerByte === 3) return XPub.fromHex(keyHex, network)
  throw new Error('Wrong key prefix')
}

export const fromString: API.FromString<ExtendedKey> = (xKey, network = 'main') => {
  const prefixStr = xKey.slice(0, 4)
  const hdSetting = getHDSetting(prefixStr, network)
  if (prefixStr === hdSetting.xpriv.prefixStr) {
    return XPriv.fromString(xKey, network)
  }
  return XPub.fromString(xKey, network)
}

export const fromSeed: API.FromSeed<ExtendedKey> = (...a) => XPriv.fromSeed(...a)

const keySelector = (privType: string, pubType: string = privType) =>
  (key: ExtendedKey, ...params: any) => {
    const { privateKey = null, publicKey = null, ...rest } = key
    if (privateKey) {
      return XPriv[privType]({ privateKey, ...rest }, ...params)
    } else if (publicKey) return XPub[pubType]({ publicKey, ...rest }, ...params)
    throw new Error('Must provide a key')
  }

// $FlowFixMe
export const fromXKey: API.FromXKey<ExtendedKey> = keySelector('fromXPriv', 'fromXPub')
export const toIndex: API.ToIndex<ExtendedKey> = keySelector('toIndex')
export const toPath: API.ToPath<ExtendedKey> = keySelector('toPath')
export const toString: API.ToString<ExtendedKey> = keySelector('toString')
export const toXPub: API.ToXPub<ExtendedKey> = keySelector('toXPub', 'fromXPub')
export const toHex: API.ToHex<ExtendedKey> = keySelector('toHex')
