// @flow

import type { CryptoInit } from '../types.js'
import { hashjs } from './hash.js'
import { secp256k1 } from './secp256k1.js'

export const init: CryptoInit = ({
  secp256k1: injectedCurve = {},
  hashjs: injectedHash = {}
} = {}) => {
  // $FlowFixMe
  secp256k1(injectedCurve)
  // $FlowFixMe
  hashjs(injectedHash)
}

export * from './hash.js'
export * from './secp256k1.js'
