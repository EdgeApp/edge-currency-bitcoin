// @flow

import { type BaseDecoder, type HashFunction } from './utils.js'

export type ScriptType = 'P2PKH' | 'P2SH' | 'P2WPKH-P2SH' | 'P2WPKH' | 'P2WSH'
export type Decoder = {
  prefixStr: string,
  prefixHex: number,
  decoder: BaseDecoder
}

export type HDPathSetting = {
  scriptType: ScriptType,
  xpriv: Decoder,
  xpub: Decoder,
  address: Decoder | Array<Decoder>
}

export type HDPathsSetting = { [purpose: string]: HDPathSetting }

export type ReplayProtection = {
  forkSighash?: number,
  forcedMinVersion?: number,
  forkId?: number
}

export type NetworkInfo = {
  coinType: number,
  wif: Decoder,
  HDPaths: HDPathsSetting,
  DefaultHDPath: number,
  txHash: HashFunction<string>,
  sigHash: HashFunction<Buffer>,
  forkOf?: string,
  replayProtection?: ReplayProtection
}

export type NewDecoder = Decoder | number
export type NewHDPathSetting = {
  scriptType?: ScriptType,
  xpriv?: NewDecoder,
  xpub?: NewDecoder,
  address: NewDecoder | Array<NewDecoder>
}
export type NewNetwork = {
  coinType?: number,
  forks?: Array<string>,
  replayProtection?: ReplayProtection,
  wif?: NewDecoder,
  HDPaths?: { [purpose: string]: NewHDPathSetting },
  DefaultHDPath?: number,
  txHash?: HashFunction<string>,
  sigHash?: HashFunction<Buffer>
}

export type NetworkInfos = { [network: string]: NetworkInfo }
export type NewNetworks = { [network: string]: NewNetwork }
