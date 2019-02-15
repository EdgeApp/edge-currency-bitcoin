// @flow

import type { ExtendedKey } from './bip32.js'

export type ScriptType = 'P2PKH' | 'P2PKH-AIRBITZ' | 'P2SH' | 'P2WPKH-P2SH' | 'P2WPKH' | 'P2WSH'
export type Chain = 'external' | 'internal'
export type Index = string
export type Path = Array<Index>

export type HDPath = {
  path: Path,
  chain?: Chain,
  scriptType?: ScriptType
}

export type HDStandardPathParams = {
  account?: number,
  coinType?: number
}

export type HDSettings = {
  [path: string]: {
    chain?: Chain,
    scriptType?: ScriptType,
    path?: (pathParams?: HDStandardPathParams) => Path,
    children?: HDSettings
  }
}

export type HDKeyPair = {
  hardened: boolean,
  children: { [index: Index]: HDKeyPair }
} & HDPath & ExtendedKey<string>
