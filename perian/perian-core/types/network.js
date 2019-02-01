// @flow

import type { Base, HashFunction } from './base.js'

export type Serializers = {
  address: Base,
  wif: Base,
  txHash: HashFunction,
  sigHash: HashFunction
}

export type ReplayProtection = {
  forkSighash: number,
  forcedMinVersion: number,
  forkId: number
}
export type KeyPrefix = {
  privkey: number,
  xpubkey: number,
  xprivkey: number,
  xpubkey58: string,
  xprivkey58: string,
  coinType: number
}

export type AddressPrefix = {
  pubkeyhash: number,
  scripthash: number,
  cashAddress?: string,
  pubkeyhashLegacy?: number,
  scripthashLegacy?: number,
  witnesspubkeyhash?: number,
  witnessscripthash?: number,
  bech32?: string
}

export type NetworkInfo = {
  magic: number,
  supportedBips: Array<number>,
  keyPrefix: KeyPrefix,
  addressPrefix: AddressPrefix,
  forks?: Array<string>,
  replayProtection?: ReplayProtection,
  serializers?: Serializers
}

export type NetworkInfos = { [networkType: string]: NetworkInfo }
