// @flow

import { type ExtendedData } from '../../types/hd.js'
import { getHDSetting } from '../core/networkInfo.js'

export const HARDENED = 0x80000000
export const SEED = '426974636f696e2073656564'
export const MAX_INDEX = 0xffffffff
export const MAX_DEPTH = 0xff
export const TWEAK_OUT_OF_RANGE_ERROR = 'tweak out of range'
export const XKEY_DEFAULTS = {
  childNumber: 0,
  parentFingerPrint: 0,
  depth: 0
}

export const dataToHex = (data: ExtendedData): string =>
  data.version.toString(16).padStart(8, '0') +
  data.depth.toString(16).padStart(2, '0') +
  data.parentFingerPrint.toString(16).padStart(8, '0') +
  data.childNumber.toString(16).padStart(8, '0') +
  data.chainCode

export const dataFromHex = (keyHex: string, network?: string): ExtendedData => {
  // Check the entire hex length
  if (keyHex.length !== 156) throw new Error('Wrong key length')

  // Check that the key prefix matches the network's prefix if given a network
  const version = parseInt(keyHex.slice(0, 8), 16)
  if (network) {
    const setting = getHDSetting(version, network)
    if (!setting) throw new Error('Wrong extended key version for network')
  }
  return {
    version,
    depth: parseInt(keyHex.slice(9, 10), 16),
    parentFingerPrint: parseInt(keyHex.slice(10, 18), 16),
    childNumber: parseInt(keyHex.slice(18, 26), 16),
    chainCode: keyHex.slice(26, 90)
  }
}
