// @flow
import type { KeyPair, MasterKeyPair } from '../types.js'

export type ScriptType = 'P2PKH' | 'P2PKH-AIRBITZ' | 'P2WPKH-P2SH' | 'P2WPKH'
export type Chain = 'external' | 'internal'
export type Index = string
export type Path = Array<Index>

export type KeyHmac = {
  left: Buffer,
  right: Buffer
}

export type DerivedPoint = {
  chainCode: Buffer,
  tweakPoint: Buffer,
  childIndex: number
}

export type DerivedKey<T> = {
  chainCode: T,
  childIndex: number
} & KeyPair<T>

export type ExtendedKey<T> = {
  version: number,
  depth: number,
  parentFingerPrint: number
} & DerivedKey<T>

export type DerivedKeyPair = DerivedKey<Buffer>
export type ExtendedKeyPair = ExtendedKey<Buffer>

export type DerivedMasterKeys = MasterKeyPair<Buffer> & DerivedKeyPair
export type ExtendedMasterKeys = MasterKeyPair<Buffer> & ExtendedKeyPair

export type HDPaths = {
  [path: string]: {
    chain?: Chain,
    path?: (...settings: any) => string,
    scriptType?: ScriptType,
    children?: HDPaths
  }
}
