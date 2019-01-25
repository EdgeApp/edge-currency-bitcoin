// @flow
import type { HDPaths } from './bip32/types.js'

export type PublicKey<T> = { publicKey: T }
export type PrivateKey<T> = { privateKey: T, publicKey?: T }
export type KeyPair<T> = { privateKey?: T, publicKey?: T }
export type MasterKeyPair<T> = { privateKey: T, publicKey: T }

export type HashFunction = (payload: Buffer) => Buffer | Promise<Buffer>
export type Alphabet = [string, string] | string
export type Base = {
  encode: (buff: Buffer) => Promise<string>,
  decode: (str: string) => Promise<Buffer>
}
export type BaseCheck = Base & { check: Base }
export type Bases = { [baseName: string]: BaseCheck }

export type ReplayProtection = {
  SIGHASH_FORKID: number,
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
  type: string,
  magic: number,
  supportedBips: Array<number>,
  keyPrefix: KeyPrefix,
  addressPrefix: AddressPrefix,
  forks?: Array<string>,
  replayProtection?: ReplayProtection
}

export type NetworkSettings = {
  hdSettings: HDPaths,
  scriptTemplates: Object,
  forks: Array<string>,
  supportedBips: Array<number>,
  serializers: Object,
  addressPrefix: AddressPrefix,
  keyPrefix: KeyPrefix
}
