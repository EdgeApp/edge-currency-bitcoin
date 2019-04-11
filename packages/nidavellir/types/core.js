// @flow

import { type BaseDecoder, type HashFunction } from './utils.js'

export type PublicKeyType<T> = { publicKey: T }
export type PrivateKeyType<T> = { privateKey: T, publicKey?: T }
export type KeyPairType<T> = { privateKey?: T, publicKey?: T }
export type HexPair = KeyPairType<string>

export type MasterKeyPair<T> = { privateKey: T, publicKey: T }

export type ReplayProtection = {
  forkSighash?: number,
  forcedMinVersion?: number,
  forkId?: number
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

export type NetworkInfos = { [network: string]: NetworkInfo }
export type NewNetworks = { [network: string]: $Shape<NetworkInfo> }
