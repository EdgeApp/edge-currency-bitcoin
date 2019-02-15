// @flow

import type { KeyPairType, MasterKeyPair } from './core.js'

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
} & KeyPairType<T>

export type DerivedKeyPair = DerivedKey<string>
export type DerivedMasterKeys = MasterKeyPair<string> & DerivedKey<string>

export type ExtendedKey<T> = {
  version: number,
  depth: number,
  parentFingerPrint: number
} & DerivedKey<T>

export type ExtendedKeyPair = ExtendedKey<string>
export type ExtendedMasterKeys = MasterKeyPair<string> & ExtendedKeyPair
