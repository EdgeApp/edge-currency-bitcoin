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

export type ScriptType = 'P2PKH' | 'P2SH' | 'P2WPKH-P2SH' | 'P2WPKH' | 'P2WSH'
export type Chain = 'external' | 'internal'
export type Index = string
export type Path = Array<Index>
export type HDPath = {
  path: Path,
  chain?: Chain,
  scriptType?: ScriptType
}

export type HDKeyPair = {
  hardened: boolean,
  children: { [index: Index]: HDKeyPair }
} & HDPath & ExtendedKey<string>
