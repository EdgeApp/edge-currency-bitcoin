// @flow

import type { KeyPair, MasterKeyPair } from './keyPair.js'

export type KeyHmac = {
  left: string,
  right: string
}

export type DerivedPoint = {
  chainCode: string,
  tweakPoint: string,
  childIndex: number
}

export type DerivedKey<T> = {
  chainCode: T,
  childIndex: number
} & KeyPair<T>

export type DerivedKeyPair = DerivedKey<string>
export type DerivedMasterKeys = MasterKeyPair<string> & DerivedKeyPair
