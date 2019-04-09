// @flow

import { type BaseDecoder, type HashFunction } from './utils.js'

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
  xpubkey: number,
  xprivkey: number,
  ypubkey: number,
  yprivkey: number
}

// change every prefix type to be an array
export type AddressPrefix = {
  pubkeyhash?: number,
  scripthash?: number,
  cashAddress?: string,
  witnesspubkeyhash?: number,
  witnessscripthash?: number,
  bech32?: string
}

export type Prefixes = Array<number | string> | { [type: string]: Prefixes }

export type Configurator = {
  prefixes?: Prefixes,
  formatter: BaseDecoder | HashFunction<string> | HashFunction<Buffer>
}

export type NetworkInfo = {
  coinType: number,
  bips: Array<number>,
  forks: Array<string>,
  replayProtection: ReplayProtection,
  WIFConfig: Configurator,
  HDKeyConfig: Configurator,
  addressConfig: Configurator,
  txHashConfig: Configurator,
  sigHashConfig: Configurator
}

export type PartialInfo = {
  coinType?: number,
  bips?: Array<number>,
  forks?: Array<string>,
  replayProtection?: ReplayProtection,
  WIFConfig?: Configurator,
  HDKeyConfig?: Configurator,
  addressConfig?: Configurator,
  txHashConfig?: Configurator,
  sigHashConfig?: Configurator
}

export type NetworkInfos = { [network: string]: NetworkInfo }
export type NewNetworks = { [network: string]: PartialInfo }
