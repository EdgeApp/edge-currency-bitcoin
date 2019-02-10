// @flow

import type { BaseDecoder, HashFunction } from '@perian/core-utils'

export type Serializers = {
  address: BaseDecoder,
  wif: BaseDecoder,
  xkey: BaseDecoder,
  txHash: HashFunction<string>,
  sigHash: HashFunction<Buffer>
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
  pubkeyhash?: number,
  scripthash?: number,
  cashAddress?: string,
  witnesspubkeyhash?: number,
  witnessscripthash?: number,
  bech32?: string
}

export type NetworkInfo = {
  magic: number,
  keyPrefix: KeyPrefix,
  addressPrefix: AddressPrefix,
  legacyAddressPrefix: AddressPrefix,
  supportedBips: Array<number>,
  forks: Array<string>,
  replayProtection: ReplayProtection,
  serializers: Serializers
}

export type NetworkInfos = { [networkType: string]: NetworkInfo }
