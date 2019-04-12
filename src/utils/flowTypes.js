/**
 * Created by Paul Puey 2017/11/09.
 * @flow
 */

import { type EdgeIo } from 'edge-core-js/types'

export type BitcoinFees = {
  lowFee: string,
  standardFeeLow: string,
  standardFeeHigh: string,

  // The amount of satoshis which will be charged the standardFeeLow
  standardFeeLowAmount: string,

  // The amount of satoshis which will be charged the standardFeeHigh
  standardFeeHighAmount: string,
  highFee: string,

  // The last time the fees were updated
  timestamp: number
}

export type EarnComFee = {
  minFee: number,
  maxFee: number,
  dayCount: number,
  memCount: number,
  minDelay: number,
  maxDelay: number,
  minMinutes: number,
  maxMinutes: number
}

export type EarnComFees = {
  fees: Array<EarnComFee>
}

export type EdgeSecp256k1 = {
  publicKeyCreate: (
    privateKey: Uint8Array,
    compressed: boolean
  ) => Promise<string>,
  privateKeyTweakAdd: (
    privateKey: Uint8Array,
    tweak: Uint8Array
  ) => Promise<Uint8Array>,
  publicKeyTweakAdd: (
    publicKey: Uint8Array,
    tweak: Uint8Array,
    compressed: boolean
  ) => Promise<Uint8Array>
}

export type EdgePbkdf2 = {
  deriveAsync: (
    key: Uint8Array,
    salt: Uint8Array,
    iter: number,
    len: number,
    algo: string
  ) => Promise<Uint8Array>
}

/**
 * The extra things we need to add to the EdgeIo object.
 */
export type ExtraIo = {
  +secp256k1?: EdgeSecp256k1,
  +pbkdf2?: EdgePbkdf2,
  Socket: typeof net$Socket,
  TLSSocket?: typeof tls$TLSSocket
}

/**
 * The IO object this plugin uses internally.
 */
export type PluginIo = EdgeIo & ExtraIo
