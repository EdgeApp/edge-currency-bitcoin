// @flow

import type { ExtendedKey } from './extendedKeys.js'

export type ScriptType = 'P2PKH' | 'P2PKH-AIRBITZ' | 'P2WPKH-P2SH' | 'P2WPKH'
export type Chain = 'external' | 'internal'
export type Index = string
export type Path = Array<Index>

export type HDPath = {
  path: Path,
  chain?: Chain,
  scriptType?: ScriptType
}

export type HDSettings = {
  [path: string]: {
    ...HDPath,
    path?: (...settings: any) => string,
    children?: HDSettings
  }
}

export type HDKey = {
  hardened: boolean,
  children: { [index: Index]: HDKey }
} & HDPath & ExtendedKey<string>
