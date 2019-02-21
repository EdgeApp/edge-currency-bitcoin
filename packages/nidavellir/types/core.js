// @flow

import type { BaseDecoder, HashFunction } from './utils.js'

export type PublicKeyType<T> = { publicKey: T }
export type PrivateKeyType<T> = { privateKey: T, publicKey?: T }
export type KeyPairType<T> = { privateKey?: T, publicKey?: T }
export type HexPair = KeyPairType<string>

export type MasterKeyPair<T> = { privateKey: T, publicKey: T }

export type Serializers = {
  address: BaseDecoder,
  wif: BaseDecoder,
  xkey: BaseDecoder,
  txHash: HashFunction<string>,
  sigHash: HashFunction<Buffer>
}

export type ReplayProtection = {
  forkSighash?: number,
  forcedMinVersion?: number,
  forkId?: number
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
  bips: Array<number>,
  forks: Array<string>,
  replayProtection: ReplayProtection,
  serializers: Serializers
}

export type PartialInfo = {
  magic?: number,
  keyPrefix?: KeyPrefix,
  addressPrefix?: AddressPrefix,
  legacyAddressPrefix?: AddressPrefix,
  bips?: Array<number>,
  forks?: Array<string>,
  replayProtection?: ReplayProtection,
  serializers?: Serializers
}

export type NetworkInfos = { [network: string]: NetworkInfo }
export type NewNetworks = { [network: string]: PartialInfo }
