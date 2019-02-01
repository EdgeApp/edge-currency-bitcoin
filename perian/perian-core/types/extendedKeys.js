// @flow

import type { MasterKeyPair } from './keyPair.js'
import type { DerivedKey } from './derivedKey.js'

export type ExtendedKey<T> = {
  version: number,
  depth: number,
  parentFingerPrint: number
} & DerivedKey<T>

export type ExtendedKeyPair = ExtendedKey<string>
export type ExtendedMasterKeys = MasterKeyPair<string> & ExtendedKeyPair
