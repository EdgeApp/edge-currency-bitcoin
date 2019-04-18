// @flow

import { type BaseDecoder, type HashFunction } from './utils.js'

export type PublicKeyType<T> = { publicKey: T }
export type PrivateKeyType<T> = { privateKey: T, publicKey?: T }
export type KeyPairType<T> = { privateKey?: T, publicKey?: T }
export type HexPair = KeyPairType<string>

export type MasterKeyPair<T> = { privateKey: T, publicKey: T }
export type ScriptType = 'P2PKH' | 'P2SH' | 'P2WPKH-P2SH' | 'P2WPKH' | 'P2WSH'
export type Decoder = {
  stringPrefix: string,
  prefix: number | string,
  decoder: BaseDecoder
}

export type HDPathSetting = {
  scriptType: ScriptType,
  purpose: number,
  xpriv: Decoder,
  xpub: Decoder,
  address: Decoder | Array<Decoder>
}

export type ReplayProtection = {
  forkSighash?: number,
  forcedMinVersion?: number,
  forkId?: number
}

export type NetworkInfo = {
  coinType: number,
  forks: Array<string>,
  replayProtection: ReplayProtection,
  wif: Decoder,
  supportedHDPaths: Array<HDPathSetting>,
  txHash: HashFunction<string>,
  sigHash: HashFunction<Buffer>
}

export type NewDecoder = Decoder | number
export type NewHDPathSetting = {
  scriptType?: ScriptType,
  purpose: number,
  xpriv?: NewDecoder,
  xpub?: NewDecoder,
  address: NewDecoder | Array<NewDecoder>
}
export type NewNetwork = {
  coinType?: number,
  forks?: Array<string>,
  replayProtection?: ReplayProtection,
  wif?: NewDecoder,
  supportedHDPaths?: Array<NewHDPathSetting>,
  txHash?: HashFunction<string>,
  sigHash?: HashFunction<Buffer>
}

export type NetworkInfos = { [network: string]: NetworkInfo }
export type NewNetworks = { [network: string]: NewNetwork }
